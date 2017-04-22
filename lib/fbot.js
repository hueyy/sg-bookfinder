/* jshint asi:true */
const request = require("request")

const bot = require("./fbot-api.js"),
			bookfinder = require("./sg-bookfinder.js")

let db = {} //in-memory db {id: state}

function fbot(){}

fbot.prototype.setup = env => bot.setup(env)

let canned = {
	start: {
		text: "Hi, what you want?",
		buttons: [
			{content_type:"text",title:"book",payload:JSON.stringify({action:"find book"})},
			{content_type:"text", title:"library", payload:JSON.stringify({action:"find library"})},
			{content_type:"text", title:"goodreads", payload:JSON.stringify({action:"goodreads"})}
		]
	},
	library: {
		text: "You want go which library?",
		buttons: [
			{content_type:"text", title:"nearest", payload:JSON.stringify({action:"nearest library"})}
		]
	}
}

let handlePayload = (event, payload) => {
	try{
		payload = JSON.parse(payload)
	} catch (e) {
		console.error(e)
		return
	}
	if(!payload.action){
		console.error(`What kind of payload is this ${JSON.stringify(payload)}`)
		return
	}
	switch(payload.action){
		case 'get started':
			bot.sendQuickReply(event.sender.id, canned.start.text, canned.start.buttons)
			break
		case 'find book':
			bot.sendTextMessage(event.sender.id, "What book you looking for?")
			db[event.sender.id] = 'find book'
			break
		case 'find library':
			bot.sendQuickReply(event.sender.id, canned.library.text, canned.library.buttons)
			db[event.sender.id] = 'find library'
			break
		case 'nearest library':
			bot.sendTextMessage(event.sender.id, "Okay I find for you")
			break
		case 'is book available':
			if('book' in payload){
				bot.sendTextMessage(event.sender.id, `Yes, ${payload.book.TitleName} is available`)
			} else {
				console.error(`'book' not in payload ${JSON.stringify(payload)}`)
			}
			break
	}
}

let handleMessage = event => {
	switch(db[event.sender.id]){
		case 'find book':
			// I'm telling you what book I want
			if(event.message.text){
				//bot.sendTextMessage(event.sender.id, "Okay I find book for you")
				bot.sendTyping(event.sender.id, true)
				console.log(event.message.text)
				console.log(bookfinder.findInNLB(event.message.text))
				bookfinder.findInNLB(event.message.text).then(result => {
					console.log(result)
					result = result.filter(v => v.MediaCode === 'BK')
						.sort((a,b) => {
							return a.TitleName.localeCompare(b.TitleName)
							//return a.titleName.charCodeAt(0) - b.titleName.charCodeAt(0)
						}).slice(0, 4)
					result.forEach((v,i,a) => { // removes hardcover/paperback dupes
						if(a.filter(b => b.ISBN.indexOf(v.ISBN)).length > 0){
							a.splice(i,1)
						}
					})
					console.log(result)
					let results = []
					result.forEach(v => {
						results.push({
							title: `${v.TitleName} (${v.PublishYear})`,
							subtitle: v.Author,
							/*default_action: {
								type: 'postback',
								payload: JSON.stringify({action:'is book available', book:v})
							},*/
							buttons: [{
								type: 'postback',
								title: 'availability',
								payload: JSON.stringify({action:'is book available', book:v})
							}]
						})
					})
					bot.sendTemplateMessage(event.sender.id, {
						template_type: 'list',
						top_element_style: 'compact',
						elements: results
					})
					//bot.sendTyping(event.sender.id, false)
				}).catch(err => console.error(err))
			} else {
				bot.sendTextMessage(event.sender.id, "Eh what kind of book is that?? Give me the title of the book lah...")
			}
			break
			
		case 'find library':
			// I'm telling you what library I want
			bot.sendTextMessage(event.sender.id, "Okay I find library for you")
			break
		
		default: // includes 'default'
			// I'm lost and I'm not sure what to do
			bot.sendQuickReply(event.sender.id, canned.start.text, canned.start.buttons)
			break
	}
}

let receivedPostback = event => {
	console.log(`Received postback for user ${event.sender.id} and page ${event.recipient_id} at ${event.timestamp} with payload ${event.postback.payload}`)
	if(event.postback.payload){
		handlePayload(event, event.postback.payload)
	}
}

let receivedMsg = event => {
	//console.log(JSON.stringify(event))
	console.log(`Received message for user ${event.sender.id} and page ${event.recipient.id} at ${event.timestamp} with message: ${JSON.stringify(event.message)}`)
	console.log(event)
	if(event.sender.id in db){
		// I know you !
		if(event.message.quick_reply && event.message.quick_reply.payload){
			handlePayload(event, event.message.quick_reply.payload)
		} else {
			handleMessage(event)
		}
	} else {
		// first conversation
		bot.sendQuickReply(event.sender.id, canned.start.text, canned.start.buttons)
		db[event.sender.id] = 'default'
	}
	/*sendTextMessage(event.sender.id, event.message.text)
	sendTemplateMessage(event.sender.id, [
		{
			title:"Hot Potato",
			subtitle:"the best potatoes money can buy",
			item_url:"hotpotato.com",
			image_url:"https://img.clipartfest.com/ccf8bc742f59244af90aa6af8e674c87_consequence-hot-potato-game-hot-potato-game-clipart_500-494.jpeg",
			buttons: [
				{type: "web_url",
					url: "https://waffle.press",
					title: "Cure Cancer"
				},
				{type: "web_url",
					url: "https://ketupat.me",
					title: "World Peace"
				}
			]
		}
	])
	bot.sendQuickReply(event.sender.id, "What miracle do you wish to perform today?", [
		{
			"content_type":"text",
			"title":"Cure Cancer",
			"payload":"cure world cancer now"
		},
		{
			"content_type":"text",
			"title":"Center a div vertically",
			"payload":"omg css"
		},
		{
			"content_type":"text",
			"title":"Invent FTL",
			"payload":"superluminal"
		}
	])*/
}

fbot.prototype.incoming = (req, res) => {
	console.log(req.query)
	res.status(200).send("OK")
	if (req.body.object === 'page') {
		// Iterate over each entry - there may be multiple if batched
		req.body.entry.forEach(entry => {
			let pageID = entry.id
			let timeOfEvent = entry.time
			// Iterate over each messaging event
			entry.messaging.forEach(event => {
				if (event.message) {
					receivedMsg(event)
				} else if (event.postback){
					receivedPostback(event)
				} else {
					console.log("Webhook received unknown event: ", event)
				}
			});
		})
	}
}

module.exports = new fbot()