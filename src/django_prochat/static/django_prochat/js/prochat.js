
        // Utilities
        const getScreensArrayJsonFromStringifiedSingleScreenJson = (singleScreenJsonString) => {
            if (singleScreenJsonString) {
                try {
                    return JSON.parse("[" + singleScreenJsonString + "]");
                } catch (error) {
                    console.error("getScreensArrayJsonFromStringifiedSingleScreenJson Json parse", error);
                    return null;
                }
            }
        };

        const isJsonCodeContainsAllScreenData = (allScreensJsonCode) => {
            if (allScreensJsonCode != null && typeof allScreensJsonCode == "object" && allScreensJsonCode.length > 0) {
                const badScreenObj = allScreensJsonCode.find((singleScreenObj) => {
                    if (singleScreenObj == null || typeof singleScreenObj != "object" || Object.keys(singleScreenObj) < 1) {
                        return true;
                    }
                });
                return !badScreenObj;
            }
            return false;
        };

        const sendUserCodeToIframe = (iframe, screensArr, iframeUrl) => {
            if (iframe != null && iframe.contentWindow != null) {
                iframe.contentWindow.postMessage(JSON.stringify(screensArr), iframeUrl);
            }
        };

        const sendScreenJsonToIframe = (screenJson, iframeId, iframeUrl) => {
            if (screenJson) {
                const parsed = getScreensArrayJsonFromStringifiedSingleScreenJson(screenJson);
                if (parsed && isJsonCodeContainsAllScreenData(parsed)) {
                    const iframe = document.getElementById(iframeId);
                    sendUserCodeToIframe(iframe, parsed, iframeUrl);
                }
            }
        };

        // Network (using fetch instead of axios)
        const retrieveIframeCode = async ({ code, apiKey, prompt }) => {
            try {
                const response = await fetch("https://www.prochat.dev/apps/api/v1/retrieve/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: apiKey,
                    },
                    body: JSON.stringify({ code, prompt }),
                });
                if (response.status === 200) {
                    return await response.json();
                }
                return await response.json();
            } catch (error) {
                throw new Error(error.message || "Network error");
            }
        };

        // ProChat function (init with props)
        const ProChat = (props) => {
            const {
                code,
                apiKey,
                width = 640,
                height = 0,
                id = 'prochat-id',
                prompt,
                json,
                onActionListener,
                debug = false,
                credentials = null,
                menu = [],
                print = true,
                container = document.getElementById('prochat-root') // Default container
            } = props;

            const static_url = "https://www.prochat.dev/apps/api/v1/iframe/static/";
            const DEBOUNCE_DELAY = 1000;

            let iframeData = null;
            let parentDimensions = { width, height };
            let errorText = null;
            let dimensionRef = { width: null, height: null };
            let iframeElementRef = null;

            const containerEl = document.createElement('div');
            containerEl.className = 'no-scrollbar group';
            containerEl.style.cssText = `
                position: relative;
                height: ${height}px;
                width: ${width}px;
                overflow-y: scroll;
                scrollbar-width: none;
            `;
            let hovered = false;
            containerEl.addEventListener('mouseenter', () => { hovered = true; updateMenu(); });
            containerEl.addEventListener('mouseleave', () => { hovered = false; updateMenu(); });

            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: absolute;
                right: 0;
                left: 0;
                bottom: 0;
                z-index: 50;
                display: flex;
                align-content: center;
                align-items: center;
                justify-content: center;
                padding: 10px;
                background-color: rgba(255, 0, 0, 0.8);
                display: none;
            `;
            const errorP = document.createElement('p');
            errorP.style.cssText = 'color: white; font-size: 12px; margin: 0;';
            errorDiv.appendChild(errorP);

            const menuDiv = document.createElement('div');
            menuDiv.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background-color: white;
                box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
                border-radius: 0.75rem;
                padding: 0.5rem;
                pointer-events: auto;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                transition: all 300ms ease-out;
                opacity: 0;
                transform: translateY(0.5rem);
            `;

            function updateMenu() {
                menuDiv.style.opacity = hovered ? '1' : '0';
                menuDiv.style.transform = hovered ? 'translateY(0)' : 'translateY(0.5rem)';
            }

            function sendCredentials() {
                if (iframeElementRef) {
                    iframeElementRef.contentWindow.postMessage(
                        JSON.stringify({ data: { credentials, debug } }),
                        static_url
                    );
                }
            }

            function onIframeLoad() {
                iframeElementRef = document.getElementById(id);
                if (iframeData && iframeData.json) {
                    sendScreenJsonToIframe(iframeData.json, id, static_url);
                } else if (json) {
                    sendScreenJsonToIframe(json, id, static_url);
                }
                sendCredentials();
            }

            function updateError() {
                errorP.textContent = debug ? (code || prompt ? errorText : null) : null;
                errorDiv.style.display = errorText ? 'flex' : 'none';
            }

            function onPrintClick() {
                if (iframeElementRef) {
                    iframeElementRef.contentWindow.postMessage(
                        JSON.stringify({ data: { type: "PRINT", id } }),
                        static_url
                    );
                }
            }

            const getCodeFromServer = async () => {
                try {
                    const data = await retrieveIframeCode({ apiKey, code, prompt });
                    if (data && data.json) {
                        iframeData = data;
                        sendScreenJsonToIframe(data.json, id, static_url);
                        errorText = null;
                        updateError();
                    }
                } catch (error) {
                    errorText = error.message;
                    updateError();
                }
            };

            let debounceTimer;
            const debounceEffect = () => {
                if (code == null && prompt == null) return;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(getCodeFromServer, DEBOUNCE_DELAY);
            };

            // Expose dimensions (like forwardRef)
            window.ProChatInstance = window.ProChatInstance || {};
            window.ProChatInstance[id] = {
                get width() { return dimensionRef.width || null; },
                get height() { return dimensionRef.height || null; }
            };

            // Message listener
            const messageHandler = (event) => {
                const iframeWindow = document.getElementById(id)?.contentWindow;
                if (event.source === iframeWindow) {
                    const { type, payload } = event.data;
                    switch (type) {
                        case 'RESIZE_LISTENER':
                            if (payload.height && payload.width && height === 0) {
                                dimensionRef = { width: payload.width, height: payload.height };
                                parentDimensions = { ...parentDimensions, height: payload.height };
                                containerEl.style.height = `${payload.height}px`;
                            }
                            break;
                        case 'ACTION_LISTENER':
                            if (onActionListener && typeof onActionListener === 'function') {
                                onActionListener({
                                    type: payload.type,
                                    component: JSON.parse(payload.component)
                                });
                            }
                            break;
                    }
                }
            };
            window.addEventListener('message', messageHandler);

            // Run on init or changes (simulate useEffect)
            if (code || prompt) debounceEffect();

            // Json effect
            if (json && id) {
                sendScreenJsonToIframe(json, id, static_url);
            }

            // Debug effect
            if (debug) {
                console.log('ProChat initialised');
            }

            // Build menu
            const MENU = print ? [{ key: "print", icon: createPrintButton(), name: "Print" }] : [];
            const fullMenu = [...MENU, ...menu.map(item => ({ ...item, icon: item.icon || createDefaultIcon(item.name) }))];
            fullMenu.forEach(item => {
                let menuItemEl;
                if (typeof item.icon === 'string') {
                    menuItemEl = document.createElement('div');
                    menuItemEl.style.cssText = `
                        padding: 8px;
                        border-radius: 8px;
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        transition: background 0.2s ease;
                    `;
                    menuItemEl.innerHTML = item.icon;
                    menuItemEl.title = item.name;
                    menuItemEl.addEventListener('mouseenter', (e) => e.currentTarget.style.background = "#f0f0f0");
                    menuItemEl.addEventListener('mouseleave', (e) => e.currentTarget.style.background = "transparent");
                } else {
                    menuItemEl = item.icon;
                }
                if (item.key === 'print') {
                    menuItemEl.addEventListener('click', onPrintClick);
                }
                menuDiv.appendChild(menuItemEl);
            });
            updateMenu();
            updateError();

            // Create iframe after functions are defined
            const iframe = document.createElement('iframe');
            iframe.name = 'preview';
            iframe.title = 'iframe';
            iframe.id = id;
            iframe.src = static_url;
            iframe.height = '100%';
            iframe.width = '100%';
            iframe.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: transparent;
                border: none;
                overflow-y: none;
                scrollbar-width: none;
            `;
            iframe.allowTransparency = true;
            iframe.onload = onIframeLoad;

            containerEl.append(iframe, errorDiv, menuDiv);
            container.appendChild(containerEl);

            // Cleanup
            return () => {
                window.removeEventListener('message', messageHandler);
                clearTimeout(debounceTimer);
                container.removeChild(containerEl);
            };
        };

        const createPrintButton = () => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');

            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M6 9V2h12v7');
            const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('d', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2');
            const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path3.setAttribute('d', 'M6 14h12v8H6z');

            svg.append(path1, path2, path3);

            const div = document.createElement('div');
            div.style.cssText = 'padding: 8px; border-radius: 8px; background: transparent; border: none; cursor: pointer; transition: background 0.2s ease;';
            div.appendChild(svg);
            return div;
        };

        const createDefaultIcon = (name) => {
            const div = document.createElement('div');
            div.textContent = name.charAt(0);
            div.style.cssText = 'font-size: 24px; cursor: pointer;';
            return div;
        };    