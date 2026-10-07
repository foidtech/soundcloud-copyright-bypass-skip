function copyrightBypassSkip(initialConfig) {
    if (window.__scrpcCopyrightBypassSkipLoaded) return null;
    window.__scrpcCopyrightBypassSkipLoaded = true;

    var TAG = '[copyright-bypass-skip]';
    var POLL_MS = 250;
    var LEAD_IN_SECONDS = 0.4;
    var RETRY_AFTER_MS = 30000;
    var MAX_CACHED_TRACKS = 100;

    var config = Object.assign({}, initialConfig);
    var mediaElements = new Set();
    var analyses = new Map();
    var hooksActive = true;
    var restorePlay = null;
    var removeTimeHook = null;
    var lastSeek = { media: null, target: -1, at: 0 };
    var pollTimer = null;
    var toast = null;
    var toastTimer = null;

    function setConfig(next) {
        var before = JSON.stringify(config);
        config = Object.assign({}, config, next);
        if (JSON.stringify(config) !== before) analyses.clear();
    }

    function remember(media) {
        if (!hooksActive || !(media instanceof HTMLMediaElement) || mediaElements.has(media)) return;
        mediaElements.add(media);
        media.addEventListener('timeupdate', tick);
    }

    function hookPlay() {
        var proto = HTMLMediaElement.prototype;
        var original = proto.play;
        var patched = function() {
            remember(this);
            return original.apply(this, arguments);
        };
        proto.play = patched;
        restorePlay = function() {
            if (proto.play === patched) proto.play = original;
        };
    }

    function hookCurrentTime() {
        var proto = HTMLMediaElement.prototype;
        var original = Object.getOwnPropertyDescriptor(proto, 'currentTime');
        if (!original || !original.get || !original.configurable) return;

        var active = true;
        var getter = function() {
            if (active) remember(this);
            return original.get.call(this);
        };
        Object.defineProperty(proto, 'currentTime', {
            configurable: true,
            enumerable: original.enumerable,
            get: getter,
            set: original.set,
        });
        removeTimeHook = function() {
            active = false;
            var current = Object.getOwnPropertyDescriptor(proto, 'currentTime');
            if (current && current.get === getter) Object.defineProperty(proto, 'currentTime', original);
        };
    }

    function dropTimeHookOncePlaying() {
        if (!removeTimeHook) return;
        var playing = false;
        mediaElements.forEach(function(media) {
            if (!media.paused) playing = true;
        });
        if (playing) {
            removeTimeHook();
            removeTimeHook = null;
        }
    }

    function trackPath(href) {
        if (!href) return null;
        try {
            return new URL(href, location.origin).pathname.replace(/\/+$/, '') || null;
        } catch (e) {
            return null;
        }
    }

    function getClientId() {
        var entries = performance.getEntriesByType('resource');
        for (var i = entries.length - 1; i >= 0; i--) {
            var match = /api-v2\.soundcloud\.com\/.*[?&]client_id=([^&]+)/.exec(entries[i].name);
            if (match) return decodeURIComponent(match[1]);
        }
        var hydration = window.__sc_hydration || [];
        for (var j = 0; j < hydration.length; j++) {
            if (hydration[j].hydratable === 'apiClient' && hydration[j].data) return hydration[j].data.id;
        }
        return null;
    }

    function fetchJson(url) {
        return fetch(url).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        });
    }

    function findSilentRegions(samples, duration) {
        if (!Array.isArray(samples) || !samples.length || !(duration > 0)) return [];

        var secondsPerSample = duration / samples.length;
        var minSamples = Math.max(1, Math.ceil(config.minSilenceSeconds / secondsPerSample));
        var regions = [];
        var runStart = -1;

        for (var i = 0; i <= samples.length; i++) {
            if (i < samples.length && samples[i] <= config.silenceLevel) {
                if (runStart < 0) runStart = i;
                continue;
            }
            if (runStart >= 0 && i - runStart >= minSamples) {
                var leading = runStart === 0;
                var trailing = i === samples.length;
                var wanted = trailing ? config.skipTrailing : leading ? config.skipLeading : config.skipMiddle;
                if (wanted) {
                    var start = runStart * secondsPerSample;
                    regions.push({
                        start: start,
                        skipTo: Math.max(start, i * secondsPerSample - LEAD_IN_SECONDS),
                        trailing: trailing,
                    });
                }
            }
            runStart = -1;
        }
        return regions;
    }

    function analyze(path) {
        var entry = { status: 'pending', regions: [], duration: 0, failedAt: 0 };
        analyses.delete(path);
        analyses.set(path, entry);
        if (analyses.size > MAX_CACHED_TRACKS) analyses.delete(analyses.keys().next().value);

        var clientId = getClientId();
        var resolveUrl = 'https://api-v2.soundcloud.com/resolve?url=' +
            encodeURIComponent('https://soundcloud.com' + path) +
            '&client_id=' + encodeURIComponent(clientId || '');

        Promise.resolve()
            .then(function() {
                if (!clientId) throw new Error('no SoundCloud client_id found on the page');
                return fetchJson(resolveUrl);
            })
            .then(function(track) {
                if (!track || track.kind !== 'track' || track.policy === 'SNIP') return;
                if (!/\.json(\?|$)/.test(track.waveform_url || '')) return;

                return fetchJson(track.waveform_url).then(function(waveform) {
                    entry.duration = track.duration / 1000;
                    entry.regions = findSilentRegions(waveform.samples, entry.duration);
                });
            })
            .then(function() {
                entry.status = 'ready';
                if (entry.regions.length) {
                    console.log(TAG, 'Silence in ' + path + ':', entry.regions.map(function(region) {
                        return formatTime(region.start) + '-' + (region.trailing ? 'end' : formatTime(region.skipTo));
                    }).join(', '));
                }
            })
            .catch(function(error) {
                entry.status = 'failed';
                entry.failedAt = Date.now();
                console.warn(TAG, 'Could not check ' + path + ':', error);
            });
    }

    function findPlayingMedia(duration) {
        var found = null;
        mediaElements.forEach(function(media) {
            if (!found && !media.paused && media.readyState >= 1 && Math.abs(media.duration - duration) < 1.5) {
                found = media;
            }
        });
        return found;
    }

    function tick() {
        dropTimeHookOncePlaying();
        if (config.enabled === false) return;

        var link = document.querySelector('.playbackSoundBadge__titleLink');
        var path = trackPath(link && link.getAttribute('href'));
        if (!path) return;

        var analysis = analyses.get(path);
        if (!analysis || (analysis.status === 'failed' && Date.now() - analysis.failedAt > RETRY_AFTER_MS)) {
            analyze(path);
            return;
        }
        if (analysis.status !== 'ready' || !analysis.regions.length) return;

        var media = findPlayingMedia(analysis.duration);
        if (!media || media.seeking) return;

        var time = media.currentTime;
        for (var i = 0; i < analysis.regions.length; i++) {
            var region = analysis.regions[i];
            var target = region.trailing ? media.duration - 0.05 : region.skipTo;
            if (time >= region.start - 0.1 && time < target - 0.1) {
                seek(media, target, region.trailing);
                return;
            }
        }
    }

    function seek(media, target, trailing) {
        var now = Date.now();
        if (lastSeek.media === media && Math.abs(lastSeek.target - target) < 0.5 && now - lastSeek.at < 2000) return;
        lastSeek = { media: media, target: target, at: now };

        var skipped = target - media.currentTime;
        media.currentTime = target;

        var message = 'Skipped ' + formatTime(skipped) + ' of silence' + (trailing ? ' at the end' : '');
        console.log(TAG, message);
        showToast(message);
    }

    function formatTime(seconds) {
        var total = Math.max(0, Math.round(seconds));
        var secs = total % 60;
        return Math.floor(total / 60) + ':' + (secs < 10 ? '0' : '') + secs;
    }

    function showToast(message) {
        if (!config.showToast || !document.body) return;
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'scrpc-copyright-bypass-skip-toast';
            toast.setAttribute('role', 'status');
            toast.style.cssText = [
                'position:fixed',
                'left:50%',
                'bottom:64px',
                'transform:translateX(-50%)',
                'z-index:2147483647',
                'padding:8px 14px',
                'border-radius:4px',
                'background:rgba(17,17,17,.92)',
                'color:#fff',
                'font-family:inherit',
                'font-size:13px',
                'line-height:1.4',
                'pointer-events:none',
                'opacity:0',
                'transition:opacity .2s',
            ].join(';');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function() {
            if (toast) toast.style.opacity = '0';
        }, 2500);
    }

    window.__scrpc_cleanup_copyright_bypass_skip = function() {
        clearInterval(pollTimer);
        clearTimeout(toastTimer);
        hooksActive = false;
        if (removeTimeHook) removeTimeHook();
        if (restorePlay) restorePlay();
        if (toast) toast.remove();
        mediaElements.forEach(function(media) {
            media.removeEventListener('timeupdate', tick);
        });
        mediaElements.clear();
        analyses.clear();
        delete window.__scrpcCopyrightBypassSkipLoaded;
        delete window.__scrpc_cleanup_copyright_bypass_skip;
    };

    hookPlay();
    hookCurrentTime();
    pollTimer = setInterval(tick, POLL_MS);

    return { setConfig: setConfig };
}
