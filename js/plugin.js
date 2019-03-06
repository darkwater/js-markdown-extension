var type = (document.contentType || 'unknown').toLowerCase();

if ((type === 'text/plain') || (type === 'text/markdown') || (type === 'text/x-markdown')) {
    chrome.storage.local.get({enabled: true}, function(config) {

        // Local variables
        var enabled = config.enabled;
        var console = window.console;
        var marked = window.marked;
        var hljs = window.hljs;
        var md = null;

        // Setup base body class
        document.body.setAttribute('class', enabled ? 'enabled' : 'disabled');

        // Add a listener waiting for enabled/disabled events
        chrome.storage.onChanged.addListener(function(changes, area) {
            enabled = changes.enabled.newValue;
            document.body.setAttribute('class', enabled ? 'enabled' : 'disabled');
        });

        // Add our stylesheets
        (function css() {
            for (var i = 0; i < arguments.length; i ++) {
                var href = chrome.extension.getURL('css/' + arguments[i] + '.css');
                if (href) {
                    var link = document.createElement('link');
                    link.setAttribute('rel', 'stylesheet');
                    link.setAttribute('href', href);
                    document.head.appendChild(link);
                }
            }
        })("default", "github", "markdown", "page");

        // Set up marked with our highlight parser
        marked.setOptions({ highlight: function(data, lang, callback) {
            // Language case normalization
            lang = lang && lang.toLowerCase();

            // Wrap any known language in our HLJS tag (or no highlight)
            if (lang) {
                fetch("http://172.24.0.2:4567/highlight/" + lang, { method: "POST", body: data})
                    .then(res => res.json())
                    .then(res => callback(false, "<style>" + res.styles + "</style>" + res.html));
            } else {
                callback(false, data);
            }
        }});

        // Recreate the body given some markdown text
        function render(markdown) {
            // Highlight as markdown, and render markdown
            var highlighted = hljs.highlight('markdown', markdown, true).value;
            marked(markdown, (err, rendered) => {
                // Setup the document's body
                document.body.innerHTML = '<pre class="hljs markdown markdown-source">' + highlighted +
                    '</pre><article class="markdown-body">' + rendered + "</article>";
            });

            // Return the original markdown
            return markdown;
        }


        // Evaluate our root <pre>, containing the text
        var pre = document.body.getElementsByTagName('pre')[0];
        if (pre && pre.firstChild) {

            // Remember the original text we loaded
            md = render(pre.firstChild.nodeValue);

            // Set a timer checking for file (only) changes
            if (window.location.href.startsWith('file://')) {
                console.info("Checking for changes on " + window.location.href + " every 2 seconds");

                // Set running on interval...
                window.setInterval(function() {

                    // Use an XMLHttpRequest
                    var request = new XMLHttpRequest();
                    request.open('GET', window.location.href);
                    request.send();

                    // Get notification when the state changes
                    request.onreadystatechange = function() {
                        if (request.readyState !== 4) return;

                        // Check if the text was changed
                        var text = request.responseText;
                        if (text == md) return;

                        // Some changes here... Re-render and save the content
                        console.info("Changes detected on " + window.location.href);
                        md = render(text);
                    }

                }, 2000);
            } else {
                console.info("Not checking for changes on " + window.location.href + ", reload manually");
            }
        }

    })
} else {
    console.info("Not rendering markdown for content type \"" + type + "\"");
}
