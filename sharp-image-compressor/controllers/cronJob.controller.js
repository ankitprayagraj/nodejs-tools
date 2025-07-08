import cheerio from 'cheerio'
import axios from 'axios'

export default {
    homePage: async (req, res) => {
        const response = await axios.get(`https://www.sarkariresult.com/latestjob/`);
        const $ = cheerio.load(response.data)
        function getDate(line) {
            const value = line.match(/\d{2}\/\d{2}\/\d{2,4}/g)
            return value ? value[0] : "";
        }

        const post = $('div[id="post"]');
        // Modify all anchors within the div
        $(post).find('a').each((i, element) => {
            // Get the current href
            const currentHref = $(element).attr('href').replace("https://", "");

            // Check if it's an absolute URL
            if (currentHref.startsWith('http')) {
                // Ignore external links
                return;
            }

            // Update href to point to google.com with the original path appended
            $(element).attr('href', `http://localhost:3001/cron/${encodeURIComponent(currentHref)}`);
        });
        res.status(200).send(post.html())

    },
    jobUpdate: async (req, res) => {
        const response = await axios.get(`https://${req.params.id}`);
        const $ = cheerio.load(response.data)
        function getDate(line) {
            const value = line.match(/\d{2}\/\d{2}\/\d{2,4}/g)
            return value ? value[0] : "";
        }
        const post = $('div[align="center"] div[align="left"] table');

        // function findText(element, regex) {

        //    return element.each((i, ele) => {
        //         if (regex.test($(ele).text())) {
        //             console.log($(ele).find('td:first li:contains("Application Begin').text())
        //             return $(ele)
        //         }
        //     })

        // }
        // findText(post.find('tr'), /Important Dates/i)

        // Post Title
        const title = post.find(' tr:contains("Name of Post") td:last').text();


        // Important Date
        const importantDate = post.find(' tr:contains("Important Dates") td:first ')

        const startDate = getDate(importantDate.find('li:contains("Application Begin")').text())
        const endDate = getDate(importantDate.find('li:contains("Last Date")').text())

        const applyOnline = post.find('tr').filter((i, item) => $(item).find('h2 span b').text() === "Apply Online").find('td:last a').attr('href')
        //     post.find(' tr').map(ele => {
        //         if($(ele).text() === "Apply Online") return $(ele).text();
        // } ) || ""
        const downloadNotification = post.find('tr').filter((i, item) => $(item).find('h2 span b').text() === "Download Full Notification").find('td:last a').attr('href')
        const officialSite = post.find('tr').filter((i, item) => $(item).find('h2 span b').text() === "Official Website").find('td:last a').attr('href')

        res.status(200).json({
            title,
            startDate, endDate,
            applyOnline,
            downloadNotification, officialSite
        })

    },
    plagiarismCheck: (req, res) => {
        if(process.env.NODE_ENV === "development") console.log(req.body.search)
        if(!req.body.search || req.body.search === "") return res.send({message:"Please Enter sentence."})
        try{
            let data = new FormData();
            data.append('content', req.body.search);
            data.append('lang_dime', 'ltr');
            data.append('SecureToken', 'ggggggg');
    
            let config = {
                method: 'post', headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.4567.89 Safari/537.36'
                  },
                maxBodyLength: Infinity,
                url: 'https://bloggingos.com/tools/plagiarism-checker-pro/generate-sentence',
                data: data
            };
    
            axios.request(config)
                .then((response) => {
    
                    let data = new FormData();
                    data.append('queries', (response.data.arr).join('[--atozbreak--]'));
                    data.append('SecureToken', 'ggggggg');
    
                    let config = {
                        method: 'post',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.4567.89 Safari/537.36'
                          },
                        maxBodyLength: Infinity,
                        url: 'https://bloggingos.com/tools/plagiarism-checker-pro/check',
                        data: data
                    };
    
                    axios.request(config)
                        .then((response) => {
                            res.status(200).json(response.data);
                        })
                        .catch((error) => {
                            console.log(error);
                        });
                })
                .catch((error) => {
                    console.log(error);
                });
    }catch(e){
        return res.status(500).send({message:"Please Enter sentence."})
    }
    }
}