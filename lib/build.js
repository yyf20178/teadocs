const fs = require('fs-extra')
const cheerio = require('cheerio')
const path = require('path')
const ejs = require('ejs')

const utils = require('./utils')
const parse = require('./markdown/parse')
const load = require('./config/load')
const renderConst = require('./config/render')
const minifyJs = require('./minify/minifyJS')
const minifyHTML = require('./minify/minifyHTML')

module.exports = {
    rebuild() {
        console.log("remove build dir.")
        utils.remove(this.buildDir)
        console.log("make build dir.")
        utils.mkdirs(this.buildDir)
        console.log("copy static to build dir.")
        fs.copySync(this.config.theme.dir + "/static", this.buildDir + "/static")
        if ( fs.existsSync(this.config.doc.staticDir) ) {
            let files = fs.readdirSync(this.config.doc.staticDir)
            files.forEach(name => {
                fs.copySync("./static/" + name, this.buildDir + "/static/" + name)
            })
        }
    },

    writeSearchData(searchDataset) {
        let dataTpl = utils.readFile(__dirname + "/search/dataTpl.js")
        let jsContent = ejs.render(dataTpl, {
            content: searchDataset
        })
        console.log("wrtie data of the search:", this.buildDir + "/data.js")
        utils.writeFile(this.buildDir + "/data.js", minifyJs(jsContent))
        console.log("completed!")
        process.exit(1)
    },

    writeHtml() {
        let $ = cheerio.load(this.config.nav.treeHtml, { decodeEntities: false })
        $("ul").eq(0).addClass("tea-menu-list")
        let tagsA = $("ul li a")
        let paths = []
        let searchDataset = []
        tagsA.each((i, elem) => {
            let siblings = $(elem).siblings()
            let href = $(elem).attr("href")
            let title = $(elem).text()
            $(elem).attr("title", title)
            if ( siblings.length > 0 ) {
                $(elem).append($("<i class='fa fa-angle-down'></i>"))
            }
            if ( href ) {
                $(elem).attr("href", href + ".html")
                paths.push({
                    node: $(elem),
                    title: title,
                    input: this.config.doc.dir + href + ".md",
                    output: this.buildDir + href + ".html"
                })
            }
        })
        paths.forEach((path, index) => {
            tagsA.each((i, elem) => {
                let title = $(elem).text()
                if ( title === path.title ) {
                    let parents = $(elem).parents()
                    parents.each((i, parent) => {
                        if ( parent.name === 'li' ) {
                            $(parent).children("a").addClass("active")
                        }
                    })
                }
            })
            let mdNativeContent = utils.readFile(path.input)
            mdNativeContent = ejs.render(mdNativeContent, this.data)
            let mdHtmlContent = parse(mdNativeContent)
            this.data.__MARKDOWN_CONTENT__ = mdHtmlContent
            this.data.__CUR_TITLE__ = path.title
            this.data.__NAV_HTML__ = $.html()

            let activeA = $("a")
            activeA.each((i, elem) => {
                $(elem).removeClass("active")
            })

            let htmlContent = ejs.render(this.themeBase, this.data)
            if ( this.config.theme.isMinify ) {
                htmlContent = minifyHTML(htmlContent)
            }
            console.log("output:", path.output)
            searchDataset.push({
                context: this._getParents($, path.node),
                content: mdHtmlContent
            })

            utils.writeFile(path.output, htmlContent)
        })

        this.writeSearchData(JSON.stringify(searchDataset))
    },

    _getParents($, node) {
        let nodeParents = node.parents()
        let liParents = [{
            title: $(node).text(),
            link: $(node).attr("href")
        }]
        nodeParents.each((i, elem) => {
            if ( i > 0 && elem.name === "li" ) {
                let _a = $(elem).children("a")
                let title = $(_a).text()
                let link = $(_a).attr("href")
                liParents.push({
                    title: title,
                    link: link ? link : "javascript:void(0)"
                })
            }
        })
        return liParents.reverse()
    },

    async build(sourceDir, options = {}) {
        console.log("you run: build")
        console.log("--sourceDir:", sourceDir)
        console.log("--options:", options)

        this.sourceDir = sourceDir
        this.config = load(this.sourceDir)
        this.buildDir = options.outDir ? options.outDir : this.config.doc.outDir
        this.themeDir = this.config.theme.dir
        this.themeBase = utils.readFile(this.themeDir + "/base.html")

        if (this.config.toString() === "" || this.config.toString() === "{}") {
            throw new Error(`No configuration information`)
        }

        this.data = Object.assign(renderConst(this.config), {
            titles: [
                "hello",
                "my",
                "friend",
                "fuck"
            ]
        })

        this.rebuild()
        this.writeHtml()
    }
} 