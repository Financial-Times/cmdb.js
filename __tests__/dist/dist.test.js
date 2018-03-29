import path from 'path'
import puppeteer from 'puppeteer'
import fs from 'fs'
import http from 'http'
// eslint-disable-next-line import/extensions,import/no-unresolved
import Cmdb from '../../dist/cmdb.js'

const port = 3010

const startSimpleServer = () => {
    const app = http.createServer((req, res) => {
        if (/\.ico$/.test(req.url)) {
            res.writeHead(404)
            return res.end()
        }
        let requestPath = req.url
        let mimeType = 'text/html'
        if (/\.m?js$/.test(req.url)) {
            mimeType = 'Application/javascript'
            requestPath = `../../dist${req.url}`
        }
        res.writeHead(200, {
            'Content-Type': mimeType,
        })
        const filePath = path.join(__dirname, requestPath)
        return fs.createReadStream(filePath).pipe(res)
    })

    app.listen(port)

    return app
}

describe('Distributables', () => {
    describe('Browser', () => {
        let page
        let browser
        let server

        beforeAll(async () => {
            server = startSimpleServer()
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            })
            page = await browser.newPage()
            /* eslint-disable no-console */
            page.on('console', message =>
                console.log('Browser log:', ...message.args)
            )
            page.on('pageerror', error =>
                console.error('Page error:', error.toString())
            )
            page.on('error', error => console.error('Error:', error.toString()))
            /* eslint-enable no-console */

            await page.goto(`http://localhost:${port}/index.html`)
        })

        afterAll(async done => {
            await browser.close()
            server.close(done)
        })

        test('esm module', async () => {
            expect.assertions(1)

            await expect(
                page.evaluate(cmdbKey => {
                    return new window.test[cmdbKey]({ apikey: 'stubKey' })
                }, 'CmdbEs')
            ).resolves.toBeInstanceOf(Object)
        })
    })

    test('Node module', () => {
        expect.assertions(1)

        expect(new Cmdb({ apikey: 'stubKey' })).toBeInstanceOf(Object)
    })
})
