/**
 * @name Copyright Bypass Skip
 * @author foidtech
 * @version {{VERSION}}
 * @description Skips silence songs add to bypass copyright detection. Settings are at the top of the plugin file.
 * @license MIT{{HOMEPAGE}}
 */

// edit these then click "refresh plugins" in settings (F1) to apply them
const CONFIG = {{CONFIG}};

{{SKIPPER}}

module.exports = {
    onEnable() {
        console.log('Copyright Bypass Skip enabled');
    },

    onDisable() {
        console.log('Copyright Bypass Skip disabled');
    },

    contentScript() {
        return '(' + copyrightBypassSkip.toString() + ')(' + JSON.stringify(CONFIG) + ');';
    },
};
