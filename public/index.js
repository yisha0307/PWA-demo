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
     * 向浏览器发起订阅
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
    // 监听service worker的postmessage
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function (e) {
            const action = e.data
            console.log(`receive post-message from sw, action is '${e.data}'`)
            switch (action) {
                case 'show-book':
                    location.href = 'https://book.douban.com/subject/20515024/'
                    console.log('HAHAHAHA')
                    break
                case 'contact-me':
                    location.href = 'mailto:someone@sample.com'
                    break
                default:
                    document.querySelector('#result-field').textContent = 'DEFAULT'
                    break
            }
        })
    }
    // 获得notification的用户授权
    function askPermission () {
        return new Promise(function (resolve, reject) {
            var permissionResult = Notification.requestPermission(function (result) {
                resolve(result)
            })
            if (permissionResult) {
                permissionResult.then(resolve, reject)
            }
        }).then(function (permissionResult) {
            if (permissionResult !== 'granted') {
                // granted: 用户允许了通知的显示
                // denied: 用户拒绝了通知的显示
                // default
                throw new Error('We weren\'t granted permission.')
            }
        })
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        var publicKey = 'BMKYFHAL0G0nBe7bhh8xyMr2Z6GL9IFMcYF4Dv9W2mLF8XG2vCvYdqA8cuJULz3LuQeAxjZ5tS5dxoabNKmQ3b4';
        // 注册service worker
        registerServiceWorker('./sw.js').then(function (registration) {
            return Promise.all([
                registration,
                askPermission() // return promise
            ])
        }).then(function(result) {
            const registration = result[0]
            // 添加提醒功能
            document.getElementById('notification-btn').addEventListener('click', function () {
                var title = 'PWA学习'
                var options = {
                    body: '邀请你一起学习',
                    icon: '/img/icons/book-128.png',
                    actions: [{
                        action: 'show-book',
                        title: '去看看'
                    }, {
                        action: 'contact-me',
                        title: '联系我'
                    }],
                    tag: 'pwa-starter',
                    renotify: true
                };
                // 进行消息提醒
                registration.showNotification(title, options);
            })
            console.log('Service worker注册成功')
            // 开启客户端的消息推送订阅功能
            return subscribeUserToPush(registration, publicKey)
        }).then(subscription => {
            // let body = {subscription}
            // body.uniqueid = new Date().getTime()
            // console.log('uniqueid', body.uniqueid)
            // 向server发起client的subscription信息
            return sendSubscriptionToServer(JSON.stringify(subscription))
        }).then(res => {
            console.log(res)
        }).catch(err => {
            console.log(err)
        })
    }
    // background sync 部分
    const STORE_NAME = 'SyncData'
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            const tag = 'sample_sync'
            document.querySelector('#js-sync-btn').addEventListener('click', function () {
                // registration.sync会返回一个syncManager对象
                // 包含register和getTags两个方法
                // register返回一个syncManager对象
                registration.sync.register(tag).then(function () {
                    console.log('后台同步已触发', tag)
                    // 使用postMessage和sw通信
                    const inputValue = document.querySelector('#book-search-input').value
                    const msg = JSON.stringify({type: 'bgsync', msg: {name: inputValue}})
                    navigator.serviceWorker.controller.postMessage(msg)
                }).catch(err => {
                    console.log(`后台同步触发失败 ${err}`)
                })
            })        
        })
        // 使用indexedDB储存数据
        navigator.serviceWorker.ready.then(registration => {
            return Promise.all([
                openStore(STORE_NAME),
                registration
            ])
        }).then(result => {
            const db = result[0]
            const registration = result[1]
            const tag = 'sample_sync_db'

            document.querySelector('#js-sync-db-btn').addEventListener('click', () => {
                const inputvalue = document.getElementById('book-search-input').value
                let tx = db.transaction(STORE_NAME, 'readwrite')
                let store = tx.objectStore(STORE_NAME)
                let item = {
                    tag,
                    name: inputvalue
                }
                store.put(item)

                registration.sync.register(tag).then(() => {
                    console.log('后台同步已触发，', tag)
                }).catch(err => {
                    console.log('后台同步触发发生错误，', err)
                })
            })
        })
    } 
    // 使用indexedDB 
    // localStorage无法在service worker里用
    function openStore (storeName) {
        return new Promise(function (resolve, reject) {
            if (!'indexedDB' in window) {
                reject(`cannot support indexedDB`)
            }
            const request = indexedDB.open('PWA_DB', 1)
            request.onerror = function (e) {
                console.log('连接数据库失败')
                reject(e)
            }
            request.onsuccess = function (e) {
                console.log('数据库连接成功')
                resolve(e.target.result)
            }
            request.onupgradeneeded = function (e) {
                console.log('数据库版本升级')
                const db = e.srcElement.result
                if (e.oldVersion === 0) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        var store = db.createObjectStore(storeName, {
                            keyPath: 'tag'
                        })
                        store.createIndex(storeName + 'Index', 'tag', {unique: false})
                        console.log('创建索引成功')
                    }
                }
            }
        })
    }
    
})()