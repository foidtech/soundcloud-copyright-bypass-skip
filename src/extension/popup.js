(function() {
    var defaults = {};
    SETTINGS.forEach(function(setting) {
        defaults[setting.key] = setting.default;
    });

    function save(key, value) {
        var change = {};
        change[key] = value;
        chrome.storage.sync.set(change);
    }

    function element(tag, className, text) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (text) el.textContent = text;
        return el;
    }

    function row(setting, control) {
        var label = element('label', 'row');
        var text = element('span', 'text');
        text.appendChild(element('span', 'label', setting.label));
        if (setting.hint) text.appendChild(element('span', 'hint', setting.hint));
        label.appendChild(text);
        label.appendChild(control);
        return label;
    }

    function toggle(setting, value) {
        var input = element('input', 'switch');
        input.type = 'checkbox';
        input.setAttribute('role', 'switch');
        input.checked = value;
        input.addEventListener('change', function() {
            save(setting.key, input.checked);
        });
        return row(setting, input);
    }

    function number(setting, value) {
        var wrapper = element('span', 'number');
        var input = element('input');
        input.type = 'number';
        input.min = setting.min;
        input.max = setting.max;
        input.step = 1;
        input.value = value;
        input.addEventListener('change', function() {
            var parsed = Math.round(Number(input.value));
            if (input.value === '' || !isFinite(parsed)) {
                input.value = value;
                return;
            }
            value = Math.min(setting.max, Math.max(setting.min, parsed));
            input.value = value;
            save(setting.key, value);
        });
        wrapper.appendChild(input);
        if (setting.unit) wrapper.appendChild(element('span', 'unit', setting.unit));
        return row(setting, wrapper);
    }

    chrome.storage.sync.get(defaults, function(values) {
        var enabled = document.getElementById('enabled');
        enabled.checked = values.enabled;
        document.body.classList.toggle('is-off', !values.enabled);
        enabled.addEventListener('change', function() {
            document.body.classList.toggle('is-off', !enabled.checked);
            save('enabled', enabled.checked);
        });

        var list = document.getElementById('settings');
        SETTINGS.forEach(function(setting) {
            if (setting.key === 'enabled') return;
            var value = values[setting.key];
            list.appendChild(setting.type === 'number' ? number(setting, value) : toggle(setting, value));
        });
    });

    document.getElementById('version').textContent = 'v' + chrome.runtime.getManifest().version;
})();
