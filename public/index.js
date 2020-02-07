(function () {
    document.getElementById('book-btn').addEventListener('click', queryBook)
    function queryBook () {
        const bookInput = document.getElementById('book-search-input')
        const query = bookInput.value
        const url = `/book?q=${query}&fields=id,title,image,author,publisher,price`
        let cacheData
        if (!query) {
            return window.alert('请输入关键字')
        }
        let remotePromise = getApiDataRemote(url)
        // 对缓存数据和fetch的数据进行一个比较
        getApiDataFromCache(url).then(data => {
            if (data && data.books) {
                bookInput.blur()
                document.getElementById('result-field').innerHTML = data.books
            }
            cacheData = data || {}
            return remotePromise
        }).then(data => {
            if (JSON.stringify(data) !== JSON.stringify(cacheData)) {
                bookInput.blur()
                document.getElementById('result-field').innerHTML = data.books || data.msg
            }
        })
    }
    /**
     *
     *
     * @param {url} url 请求的连接
     * @returns {Promise}
     */
    function getApiDataRemote (url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.timeout = 60000
            xhr.onreadystatechange = function () {
                var response = {}
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        response = JSON.parse(xhr.responseText)
                    }
                    catch (e) {
                        response = xhr.responseText
                    }
                    resolve(response)
                } else if (xhr.readyState === 4) {
                    resolve()
                }
            }
            xhr.onabort = reject
            xhr.onerror = reject
            xhr.ontimeout = reject
            xhr.open('GET', url, true)
            xhr.send(null)
        })
    }
    /**
     *
     * 获得cache数据
     * @param {url} url
     * @returns {Promise}
     */
    function getApiDataFromCache(url) {
        if ('caches' in window) {
            return caches.match(url).then(cache => {
                if (!cache) {
                    return
                }
                return cache.json()
            })
        } else {
            return Promise.resolve()
        }
    }
    /**
     *
     *
     * @param {file} file
     * @returns {ServiceWorker registration}
     */
    function registerServiceWorker (file) {
        return navigator.serviceWorker.register(file)
    }
    /**
     *
     * 发起订阅
     * @param {serviceWorker registration} registration
     * @param {string} publicKey
     * @returns {ServiceWorker subscription}
     */
    function subscribeUserToPush (registration, publicKey) {
        let subscribeOptions = {
            userVisibleOnly: true, // 推送时是不是有消息提醒
            applicationServerKey: window.urlBase64ToUint8Array(publicKey)
        }
        // 浏览器会跳出“显示通知”的选项
        return registration.pushManager.subscribe(subscribeOptions).then(function (pushSubscription) {
            console.log('Received pushSubscription: ', JSON.stringify(pushSubscription))
            return pushSubscription
        })
    }
    /**
     *
     * server存储客户端subscription信息
     * @param {serviceWorker subscription} body
     * @param {string} url
     * @returns {Promise}
     */
    function sendSubscriptionToServer(body, url) {
        url = url || '/subscription';
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.timeout = 60000;
            xhr.onreadystatechange = function () {
                var response = {};
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        response = JSON.parse(xhr.responseText);
                    }
                    catch (e) {
                        response = xhr.responseText;
                    }
                    resolve(response);
                }
                else if (xhr.readyState === 4) {
                    resolve();
                }
            };
            xhr.onabort = reject;
            xhr.onerror = reject;
            xhr.ontimeout = reject;
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(body);
        });
    }
    
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        var publicKey = 'BMKYFHAL0G0nBe7bhh8xyMr2Z6GL9IFMcYF4Dv9W2mLF8XG2vCvYdqA8cuJULz3LuQeAxjZ5tS5dxoabNKmQ3b4';
        // 注册service worker
        registerServiceWorker('./sw.js').then(function(registration) {
            console.log('Service worker注册成功')
            // 开启客户端的消息推送订阅功能
            return subscribeUserToPush(registration, publicKey)
        }).then(subscription => {
            let body = {subscription}
            body.uniqueid = new Date().getTime()
            console.log('uniqueid', body.uniqueid)
            // 向server发起client的subscription信息
            return sendSubscriptionToServer(JSON.stringify(body))
        }).then(res => {
            console.log(res)
        }).catch(err => {
            console.log(err)
        })
    }
})()