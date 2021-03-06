const cacheName = 'bs-0-1-1'
// 缓存xhr请求的数据
const apiCacheName = 'api-0-1-1'
const cacheFiles = [
    '/',
    './index.html',
    './index.js',
    './index.css',
    './img/book.png',
    './img/loading.svg'
]
// serviceWorker 的this是self
// 监听install事件
self.addEventListener('install', function (e) {
    console.log('Service worker状态: install')
    // 安装完成后，进行文件缓存
    // caches 是一个全局变量
    var cacheOpenPromise = caches.open(cacheName).then(function (cache) {
        return cache.addAll(cacheFiles)
    })
    e.waitUntil(cacheOpenPromise)
})

self.addEventListener('fetch', function (e) {
    const cacheRequestUrls = [
        '/book?'
    ]
    console.log(`现在正在请求： ${e.request.url}`)
    var needCache = cacheRequestUrls.some(url => {
        return e.request.url.includes(url)
    })
    // 先对xhr数据缓存做相关的操作
    if (needCache) {
        // 需要缓存
        // 使用fetch请求数据，并将请求结果clone一份存到cache
        // 此部分缓存后在browser中使用全局变量caches获取
        caches.open(apiCacheName).then(cache => {
            return fetch(e.request).then(response => {
                cache.put(e.request.url, response.clone())
                return response
            })
        })
    } else {
        // 非api请求，直接查询cache
        // 如果有就直接返回，否则通过fetch请求
        e.respondWith(caches.match(e.request).then(cache => {
            console.log(e.request)
            return cache || fetch(e.request)
        }).catch(err => {
            console.log(err)
            return fetch(e.request)
        }))
    }   
})

// 监听active事件，激活后通过cache的key来判断是否更新cache中的静态资源
self.addEventListener('activate', e => {
    console.log('service worker状态: activate')
    var cachePromise = caches.keys().then(keys => {
        return Promise.all(keys.map(key => {
            // cacheName更新了之后就删除原有的cache
            if(key !== cacheName) {
                return caches.delete(key)
            }
        }))
    })
    e.waitUntil(cachePromise);
    // 注意不能忽略这行代码，否则第一次加载会导致fetch事件不触发
    return self.clients.claim();
})

// push(推送消息)
// notification(展示提醒)
// push service当用户离线的时候，可以帮助保存消息队列，直到联网后再发送给他们
self.addEventListener('push', e => {
    let data = e.data
    if (data) {
        data = data.json()
        console.log('push的数据为', data)
        var title = 'PWA即学即用';
        var options = {
            body: data,
            icon: '/img/icons/book-128.png',
            image: '/img/icons/book-521.png', // no effect
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
        // 利用Push在关闭该web app的时候也可以收到提醒
        self.registration.showNotification(title, options)
    } else {
        console.log('push没有任何数据')
    }
})

// 响应用户对于提醒框的点击事件
self.addEventListener('notificationclick', function (e) {
    const action = e.action
    console.log(`action tag: ${e.notification.tag}`, `action: ${action}`)

    switch (action) {
        case 'show-book':
            console.log('show book')
            return
        case 'contact-me':
            console.log('contact me')
            break
        default:
            console.log(`未处理的action: ${e.action}`)
            action = 'default'
            break
    }
    e.notification.close()

    // service worker与client通信
    e.waitUntil(
        // 获取所有clients
        self.clients.matchAll().then(function (clients) {
            if (!clients || clients.length === 0) {
                // 当不存在client的时候，打开该网站
                self.clients.openWindow && self.clients.openWindow('http://127.0.0.1:8085')
                return
            }
            // 切换到该站点的tab
            clients[0].focus && clients[0].focus()
            clients.forEach(function (client) {
                // 使用postmessage通信
                client.postMessage(e.action)
            })
        })
    )
})

// add sync 监听事件
// 因为放在service worker里了，所以可以在网页关闭的时候继续做后台请求
class SimpleEvent {
    // 类似一个最简单的eventBus
    constructor () {
        this.listeners = {}
    }
    once (tag, cb) {
        this.listeners[tag] || (this.listeners[tag] = [])
        this.listeners[tag].push(cb)
    }
    trigger (tag, data) {
        this.listeners[tag] = this.listeners[tag] || []
        let listener
        while (listener = this.listeners[tag].shift()) {
            listener(data)
        }
    }
}
const simpleEvent = new SimpleEvent()
self.addEventListener('sync', function (e) {
    console.log(`service worker需要进行后台同步，tag: ${e.tag}`)
    const init = {
        method: 'GET'
    }
    // 用e.tag来判断client触发的不同sync事件
    if (e.tag === 'sample_sync') {
        // 因为e.waitUntil只接受promise，所以要对simpleEvent.once包装一下
        let msgPromise = new Promise((resolve, reject) => {
            simpleEvent.once('bgsync', function (data) {
                resolve(data)
            })
            // 5秒超时
            setTimeout(resolve, 5000);
        })

        e.waitUntil(
            msgPromise.then(function (data) {
                var name = data && data.name ? data.name : 'anonymous'
                const request = new Request(`sync?name=${name}`, init)
                return fetch(request)
            }).then(function (response) {
                response.json().then(console.log.bind(console))
                return response
            })
        )
    } else if (e.tag === 'sample_sync_db') {
        const dbQueryPromise = new Promise((resolve, reject) => {
            const STORE_NAME = 'SyncData'
            openStore(STORE_NAME).then(db => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly')
                    const store = tx.objectStore(STORE_NAME)
                    const dbRequest = store.get(e.tag)
                    dbRequest.onsuccess = e => {
                        resolve(e.target.result)
                    }
                    dbRequest.onerror = err => {
                        reject(err)
                    }
                } catch (err) {
                    reject(err)
                }
            })
        })
        e.waitUntil(
            // 通过数据库查询获取需要同步的数据
            dbQueryPromise.then(data => {
                console.log(data)
                const name = data && data.name ? data.name : 'anonymous'
                const request = new Request(`sync?name=${name}`, init)
                return fetch(request)
            }).then(response => {
                response.json().then(console.log.bind(console))
                return response
            })
        )
    }
})

self.addEventListener('message', function (e) {
    const data = JSON.parse(e.data)
    const {type = '', msg = {}} = data || {}
    console.log(`service worker收到信息 type: ${type}; msg: ${JSON.stringify(msg)}`)

    simpleEvent.trigger(type, msg)
})
/**
 *
 *
 * @param {string} storeName 存储的名字
 * @returns {Promise}
 */
function openStore (storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PWA_DB', 1)
        request.onerror = e => {
            console.log('连接数据库失败')
            reject(e)
        }
        request.onsuccess = e => {
            console.log('连接数据库成功')
            resolve(e.target.result)
        }
    })
}