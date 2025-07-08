import lighthouse from 'lighthouse'
import cheerio from 'cheerio'
import axios from 'axios'
import { TextServiceClient } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer';
import { GoDaddy, DreamHost, Hostinger, NameCom } from '../utils/domain.registrar.js'

const MODEL_NAME = "models/text-bison-001";
const API_KEY = process.env.BARD_API_KEY;

export default {
    lighthouse: (req, res) => {
        try {
            const { site } = req.query;
            async function auditWebsite(url) {
                const browser = await puppeteer.launch({ headless: "new" });
                const page = await browser.newPage();
                await page.goto(url);
                const port = new URL(browser.wsEndpoint()).port;
                const lighthouseOptions = {
                    output: "html",
                    onlyCategories: ["performance", "seo"],
                    port: port,
                };
                if (process.env.NODE_ENV === "development") lighthouseOptions.logLevel = "info";
                const results = await lighthouse(url, lighthouseOptions);
                res.send(results.report)
                await browser.close()
            }
            console.log(site)
            auditWebsite(site);
        } catch (e) {
            if (process.env.NODE_ENV === "development") console.log(e);
            return res.status(500).json({ message: "Internal server error." })
        }
    },
    onPageSeo: (req, res) => {
        try {
            const { site } = req.query;
            let seo = {};
            let error = {};
            async function bardAI(prompt) {
                try {
                    const client = new TextServiceClient({
                        authClient: new GoogleAuth().fromAPIKey(API_KEY),
                    });
                    const stopSequences = [];
                    const result = await client.generateText({
                        // required, which model to use to generate the result
                        model: MODEL_NAME,
                        // optional, 0.0 always uses the highest-probability result
                        temperature: 0.7,
                        // optional, how many candidate results to generate
                        candidateCount: 1,
                        // optional, number of most probable tokens to consider for generation
                        top_k: 40,
                        // optional, for nucleus sampling decoding strategy
                        top_p: 0.95,
                        // optional, maximum number of output tokens to generate
                        max_output_tokens: 1024,
                        // optional, sequences at which to stop model generation
                        stop_sequences: stopSequences,
                        // optional, safety settings
                        safety_settings: [{ "category": "HARM_CATEGORY_DEROGATORY", "threshold": 1 }, { "category": "HARM_CATEGORY_TOXICITY", "threshold": 1 }, { "category": "HARM_CATEGORY_VIOLENCE", "threshold": 2 }, { "category": "HARM_CATEGORY_SEXUAL", "threshold": 2 }, { "category": "HARM_CATEGORY_MEDICAL", "threshold": 2 }, { "category": "HARM_CATEGORY_DANGEROUS", "threshold": 2 }],
                        prompt: {
                            text: prompt,
                        },
                    });
                    return JSON.stringify(result[0].candidates[0].output, null, 2)
                } catch (e) {
                    console.log("Bard error: ", e)
                    return
                }
            }
            // Function to validate meta tags
            function validateMetaTags(site) {
                // Fetch the webpage content
                axios.get(site)
                    .then(response => {
                        const $ = cheerio.load(response.data);
                        const schemaData = $('script[type="application/ld+json"]').text().trim();
                        let schema = {}
                        // Check if schema data is present
                        if (schemaData) {
                            try {
                                schema = JSON.parse(schemaData)
                            } catch (e) {
                                console.log("Schema parse error: ", e.message)
                            }
                        } else {
                            console.log('No schema data found on the website.');
                        }
                        // Meta title validation
                        const title = $('title').first().text();
                        seo.title = title
                        if (title.length < 30 || title.length > 60) {
                            error.title = `Meta title length invalid: ${title.length}`
                        }
                        // Meta description validation
                        const description = $('meta[name="description"]').attr('content');
                        seo.description = description
                        if (!description || description.length < 70 || description.length > 160) {
                            error.description = !description ? `Meta description length invalid:` : `Meta description length invalid: ${description.length}`
                        }
                        // Viewport meta tag validation
                        const viewport = $('meta[name="viewport"]').attr('content');
                        seo.viewport = viewport
                        if (!viewport) {
                            error.viewport = `Missing viewport meta tag`
                        }
                        // Meta keyword tag validation
                        const keywords = $('meta[name="keywords"]').attr('content');
                        seo.keywords = keywords
                        if (!keywords || keywords.length > 255) {
                            error.keywords = !keywords ? "Meta keywords Missing." : `Meta keyword length invalid: ${keywords.length}`
                        }
                        // Meta author 
                        const author = $('meta[name="author"]').attr('content');
                        seo.author = author
                        if (!author) {
                            error.author = `Missing meta author.`
                        }
                        // Copyright validation
                        const copyright = $('meta[name="copyright"]').attr('content');
                        seo.copyright = copyright
                        if (!copyright) {
                            error.copyright = `Missing meta copyright tag`
                        }
                        // Social media meta tags validation
                        const ogTitle = $('meta[property="og:title"]').attr('content');
                        const ogDescription = $('meta[property="og:description"]').attr('content');
                        const twitterTitle = $('meta[name="twitter:title"]').attr('content');
                        const twitterDescription = $('meta[name="twitter:description"]').attr('content');
                        seo.ogTitle = ogTitle
                        seo.ogDescription = ogDescription
                        seo.twitterTitle = twitterTitle
                        seo.twitterDescription = twitterDescription
                        if (!ogTitle || !ogDescription || !twitterTitle || !twitterDescription) {
                            console.warn(`Missing social media meta tags`);
                        }
                        if (!ogTitle || ogTitle > 60) {
                            error.ogTitle = !ogTitle ? `Missing meta copyright tag` : `Meta keyword length invalid: ${ogTitle.length}`
                        }
                        if (!ogDescription || ogDescription > 200) {
                            error.ogDescription = !ogDescription ? `Missing meta copyright tag` : `Meta keyword length invalid: ${ogDescription.length}`
                        }
                        if (!twitterTitle || twitterTitle > 60) {
                            error.twitterTitle = !twitterTitle ? `Missing meta copyright tag` : `Meta keyword length invalid: ${twitterTitle.length}`
                        }
                        if (!twitterDescription || twitterDescription > 200) {
                            error.twitterDescription = !twitterDescription ? `Missing meta copyright tag` : `Meta keyword length invalid: ${twitterDescription.length}`
                        }
                        if ($) {
                            (async () => {
                                const seoPrompt = `Generate detailed, category-specific recommendations to systematically improve the SEO optimization of a website based on the following details: ${JSON.stringify(seo)} ${JSON.stringify(error)} `;
                                const result = await bardAI(seoPrompt);
                                var md = new MarkdownIt();
                                var results = md.render(result);
                                if (result) return res.status(200).json({ seo, error, generativeAi: results.replace(/(\\n)/g, "<br/>") })
                                return res.status(500).json({ message: "Internal server error." })
                            })()
                        }
                        else {
                            return res.status(500).json({ message: "Internal server error." })
                        }
                    })
                    .catch(error => {
                        if (error.code === "ENOTFOUND") {
                            return res.status(200).json({ message: `Website not found: ${site}` })
                        }
                        console.error(`Error fetching URL: ${error}`);
                        return res.status(500).json({ message: "Internal server error." })
                    });
            }
            validateMetaTags(site);
        }
        catch (e) {
            if (process.env.NODE_ENV === "development") console.log(e);
            return res.status(500).json({ message: "Internal server error." })
        }
    },
    wpDetector: async (req, res) => {
        const { site } = req.query;
        try {
            function getThemeInfo(themeSlug) {
                const themeInfoUrl = `https://api.wordpress.org/themes/info/1.1/?action=theme_information&request[slug]=${themeSlug}`;
                return axios.get(themeInfoUrl).then(response => {
                    const { download_link, rating, screenshot, last_updated, last_updated_time, num_ratings, sections, ...themeInfo } = response.data;
                    return {
                        ...themeInfo,
                        description: sections.description
                    }
                }).catch(() => null);
            }
            function getPluginInfo(pluginSlug) {
                const pluginInfoUrl = `https://api.wordpress.org/plugins/info/1.1/?action=plugin_information&request[slug]=${pluginSlug}`;
                return axios.get(pluginInfoUrl).then(response => {
                    const {
                        name,
                        version,
                        author,
                        author_profile,
                        slug,
                        last_updated,
                        sections,
                        tags
                    } = response.data;
                    const description = cheerio.load(sections.description).text().slice(0, 200);
                    const result = {
                        name,
                        version,
                        author,
                        author_profile,
                        slug,
                        last_updated,
                        description,
                        tags
                    };
                    return result
                }).catch(() => null);
            }
            async function getWebsiteInfo(url) {
                try {
                    // Try to get WordPress version from [/feed] url
                    async function getWpVersion() {
                        const response = await axios.get(`${site}/feed`)
                        const $ = cheerio.load(response.data, { xmlMode: true })
                        const urlMatch = /(\d+\.\d+\.\d+)/
                        const url = $("channel > generator").text();
                        const version = url.match(urlMatch);
                        if (version) return `WordPress ${version[0]}`;
                        return
                    }
                    // open url and get value by matching regular expression
                    async function openPageAndMatch(url, regex) {
                        try {
                            const response = await axios.get(url);
                            if (response.status === 200 && (response.data).match(/(jQuery.v)(\d.\d.\d)/i)) {
                                const result = response.data ? (response.data).match(regex) : (response.data).match(regex)[0];
                                return result
                            }
                        } catch (e) {
                            if (response && response.status === 404)
                                console.log(e.message)
                        }
                        return null
                    }
                    const response = await axios.get(url);
                    if (response.status === 200) {
                        const $ = cheerio.load(response.data);
                        let wordpressVersion = $('meta[name="generator"][content*="wordpress" i]').attr('content');
                        if (!wordpressVersion) {
                            wordpressVersion = await getWpVersion();
                        }
                        const themeInfo = $('link[href*=wp-content/themes/]').attr('href') || $('script[src*=wp-content/themes/]').attr('src');
                        const themeNameMatch = themeInfo && themeInfo.match(/.*wp-content\/themes\/(.*?)(\/assets|\/js)/i);
                        const themeName = themeNameMatch ? themeNameMatch[1].trim() : null;
                        // Plugin name detect using script
                        let pluginScripts = $('script[src*=plugins]').map((_, script) => {
                            const pluginMatch = script.attribs.src.match(/.*plugins\/(.*?)\/.*\.js/i);
                            return pluginMatch ? pluginMatch[1] : null;
                        }).get();
                        // Plugin name detect using script
                        const names = $('link[href*=plugins]').map((_, script) => {
                            const pluginMatch = script.attribs.href.match(/.*plugins\/(.*?)\/.*\.css/i);
                            return pluginMatch ? pluginMatch[1] : null;
                        }).get();
                        // Filter unique
                        pluginScripts = [...pluginScripts, ...names].filter(Boolean);
                        const librariesInfo = {
                            jQuery: null,
                            Bootstrap: null,
                            Bulma: null,
                            Foundation: null,
                            Tailwind: null
                        };
                        $('script[src]').each(async (_, script) => {
                            const jsSrc = script.attribs.src.toLowerCase();
                            if (jsSrc.includes('jquery')) {
                                const match = jsSrc.match(/ver=\/(\d+\.\d+\.\d+)/) || await openPageAndMatch(jsSrc, /v(\d.\d.\d)/i);
                                librariesInfo.jQuery = match || null;
                            } else if (jsSrc.includes('bootstrap')) {
                                const match = jsSrc.match(/bootstrap\/(\d+\.\d+\.\d+)/);
                                librariesInfo.Bootstrap = match ? match[1] : null;
                            } else if (jsSrc.includes('bulma')) {
                                const match = jsSrc.match(/bulma\/(\d+\.\d+\.\d+)/);
                                librariesInfo.Bulma = match ? match[1] : null;
                            } else if (jsSrc.includes('foundation')) {
                                const match = jsSrc.match(/foundation\/(\d+\.\d+\.\d+)/);
                                librariesInfo.Foundation = match ? match[1] : null;
                            } else if (jsSrc.includes('tailwind')) {
                                const match = jsSrc.match(/tailwindcss\/(\d+\.\d+\.\d+)/);
                                librariesInfo.Tailwind = match ? match[1] : null;
                            }
                        });
                        const websiteInfo = {
                            'WordPress Version': wordpressVersion,
                            'Theme Name': themeName,
                            'Plugins': Array.from(new Set(pluginScripts)),
                            'Libraries Info': librariesInfo
                        };
                        return websiteInfo;
                    } else {
                        res.json({ message: "Internal server error." });
                        console.log('Failed to retrieve the URL. Status code:', response.status);
                        return null;
                    }
                } catch (error) {
                    throw new Error(error.code);
                }
            }
            const url = site.match(/^(https?:\/\/[^/]+)/)[0];
            const result = await getWebsiteInfo(url);
            if (result) {
                let themeInfo = null;
                const pluginInfo = {};
                if (result['Theme Name']) {
                    themeInfo = await getThemeInfo(result['Theme Name'].toLowerCase());
                }
                if (themeInfo) result['Theme Name'] = themeInfo.name
                // Async Plugin info
                if (result['Plugins']) {
                    const plugins = result['Plugins'];
                    // Define an asynchronous function to get plugin information
                    const getPluginInfoAsync = async (plugin) => {
                        const pluginData = await getPluginInfo(plugin.toLowerCase());
                        return pluginData || null;
                    };
                    // Use Promise.all to concurrently fetch plugin information
                    const pluginInfoPromises = plugins.map(getPluginInfoAsync);
                    // Wait for all promises to resolve
                    const pluginInfoArray = await Promise.all(pluginInfoPromises);
                    // Update the result with the retrieved plugin information
                    result['Plugins'] = pluginInfoArray.map((pluginData, index) => {
                        pluginInfo[plugins[index]] = pluginData || null;
                        return pluginData !== null ? pluginData.name : plugins[index];
                    });
                    if (!themeInfo && !result['Theme Name'] && !result['Plugins'][0]) {
                        return res.json({ message: "Not a Wordpress site." });
                    }
                    return res.json({ result, themeInfo, pluginInfo });
                }
            } else {
                return res.json({ result: null, error: false });
            }
        } catch (e) {
            console.log(e)
            if (e.message === "ENOTFOUND") {
                return res.status(200).json({ message: `Website not found: ${site}` })
            } else if (e.message === "ERR_BAD_REQUEST") {
                return res.status(200).json({ message: `Website link working: ${site}` })
            }
            return res.json({ message: "Internal server error." });
        }

    },
    kooAppKeywords: async (req, res) => {
        const response = await axios.get('https://www.kooapp.com/explore');
        const $ = cheerio.load(response.data)
        const url = $('div[id="trendHeaders"]').text();
        const cards = $('div[id="trendHeaders"]').find('.Explore_hashtag__1xsWT');
        // Create an array to store the content of each card
        const cardContents = [];
        // Loop through each card and add its content to the array
        cards.each(function () {
            cardContents.push($(this).text());
        });
        // Print the array of card contents
        console.log(cardContents);
        console.log(url)
        res.send({ trending: cardContents })
    },
    domainAvailable: (req, res) => {
        const { domain } = req.query;

        const data = [];
        function godaddy(domain) {
            // dev
            // const godaddy = new GoDaddy('3mM44UdBRjEj5z_QT2MhhTftUhP5VLGjff6em', '2wu1TkCEtPdHrRgjvDK3vtd');
            // Example usage remains the same:
            //pro
            const godaddy = new GoDaddy('dLiK2wFNAJUz_Fukn8n1arTdJrvpuNWfpmg', '3JLwtKgXBSnZtLMZAWxYvH');
            return (async () => {
                try {
                    const { isAvailable, price } = await godaddy.checkDomainAvailability(domain);

                    return { godaddy: { isAvailable, price } }
                } catch (err) {
                    console.error('Error:', err);
                }
            })();
        }

        function hostingerDomain(domain) {
            const hostinger = new Hostinger('your_auth_token');
            return (async () => {
                try {

                    const result = await hostinger.checkDomainAvailability(domain)

                    const { available, price } = result;
                    console.log(`Domain available: ${available}, price: ${price}`);
                } catch (e) {
                    console.error('Error:', error);

                };
            })()

        }
        //Name.com

        // Example usage remains the same:
        function nameComDomain(domain) {
            const client = new NameCom('ankitkashyap', 'f71e6712d7c75e73f823f0e16c7b0a18c24462f4');
            return (async () => {
                try {
                    const [isAvailable, price, error] = await client.checkDomainAvailability(domain)
                    if (error) {
                        console.error('Error:', error);
                    } else {
                        return { nameCom: { isAvailable, price } }

                    }
                } catch (e) {

                    console.error('Error:', e);

                }

            })()

        }
        data.push(nameComDomain(domain))

        // Example usage:
        function dreamHost(domain) {
            const dreamHost = new DreamHost();
            dreamHost.checkDomainAvailability('example.com')
                .then((result) => {
                    console.log('Domain available:', result.available);
                    console.log('Price:', result.price);
                })
                .catch((err) => {
                    console.error('Error:', err);
                });
        }
        data.push(godaddy(domain))
        
        Promise.all(data).then((data) => {
            res.status(200).json(data)
        })

    }
}