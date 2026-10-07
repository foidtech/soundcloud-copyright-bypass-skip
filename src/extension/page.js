(function() {
{{SKIPPER}}

    var skipper = copyrightBypassSkip({{DEFAULTS}});
    if (!skipper) return;

    document.addEventListener('copyright-bypass-skip:settings', function(event) {
        try {
            skipper.setConfig(JSON.parse(event.detail));
        } catch (e) {}
    });
    document.dispatchEvent(new CustomEvent('copyright-bypass-skip:ready'));
})();
