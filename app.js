const util = require('./util')
const Koa = require('koa')
const Router = require('koa-router')
const serve = require('koa-static')
const koaBody = require('koa-body')
const webpush = require('web-push')
const get = require('./util').get
const app = new Koa()
const router = new Router()

router.get('/book', async ctx => {
    /**
     * @returns {object} query
     */
    const query = ctx.request.query
    const {q, fields} = query || {}
    const url = `https://api.douban.com/v2/book/search?q=${q}&fields=${fields}&count=10`;
    const result = await get(url)
    ctx.body = result
})
/**
 * 使用web-push进行消息推送
 */
const options = {
    proxy: "http://localhost:1087"
}
/**
 * VAPID for web-push
 * web-push generate-vapid-keys --json：生成public key和private key
 */
let vapidKeys = {
    "publicKey":"BMKYFHAL0G0nBe7bhh8xyMr2Z6GL9IFMcYF4Dv9W2mLF8XG2vCvYdqA8cuJULz3LuQeAxjZ5tS5dxoabNKmQ3b4",
    "privateKey":"3sz831s3Ais0epMujW6S-5I7njnPpSYHtdjzcPy6uiA"
}
webpush.setVapidDetails(
    'mailto:chenchen9037@126.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
)
/** 
 * 提交subscription信息，并保存
*/
router.post('/subscription', koaBody(), async ctx => {
    let body = ctx.request.body;
    await util.saveRecord(body);
    ctx.response.body = {
        status: 0
    };
});
/**
 * 消息推送API，可以在管理后台进行调用
 * 为了方便起见，直接post一个请求来查看效果
 */
router.post('/push', koaBody(), async ctx => {
    let payload = ctx.request.body;    
    let list = await util.findAll();
    let status = list.length > 0 ? 0 : -1;

    for (let i = 0; i < list.length; i++) {
        let subscription = list[i];
        pushMessage(subscription, JSON.stringify(payload));
    }

    ctx.response.body = {
        status
    };
});

/**
 * 使用webpush
 * 向push service发送请求
 * @param {ServiceWorker subscription} subscription
 * @param {Object} [data={}]
 */
function pushMessage(subscription, data = {}) {
    webpush.sendNotification(subscription, data).then(data => {
        console.log('push service的相应数据:', JSON.stringify(data));
        return;
    }).catch(err => {
        // 判断状态码，440和410表示失效
        if (err.statusCode === 410 || err.statusCode === 404) {
            return util.remove(subscription);
        }
        else {
            console.log(subscription);
            console.log(err);
        }
    })
}

app.use(router.routes())
app.use(serve(__dirname + '/public')) // 放置静态资源
app.listen(8086, () => {
    console.log('8086 port is working')
})