/* jshint asi:true */
/* Goodreads - Handles all connectivity to Goodreads API */
/* API Docs: http://www.goodreads.com/api */

const http = require('http'),
			utils = require('utils')
			xml2js = require('xml2js'),
			oauth = require('oauth').OAuth,
			querystring = require('querystring')

var Goodreads = (function() {
  let clone
  Goodreads = class Goodreads {
    static initClass() {
      clone = function(obj) {
        if ((obj !== null) || (typeof(obj) !== 'object')) {
          return obj;
        }
      }
    }

    /* CONFIG */

    // Default JSON options
    constructor(config) {
      this.options = {
        host: 'www.goodreads.com',
        port: 80,
        key: config.key,
        secret: config.secret,
        callback: config.callback || 'http://localhost:3000/callback',
        method: 'GET',
        path: '',
        endpoint: 'https://www.goodreads.com',
        oauth_request_url: 'https://goodreads.com/oauth/request_token',
        oauth_access_url: 'https://goodreads.com/oauth/access_token',
        oauth_version: '1.0A',
        oauth_encryption: 'HMAC-SHA1'
      };
      this.oauthAccessToken = ''
      this.oauthAcessTokenSecret = ''
      this.client = null
    }

    configure(gr_key, gr_secret, gr_callback) {
      this.options.key = gr_key || this.options.key
      this.options.secret = gr_secret || this.options.secret
      this.options.callback = gr_callback || this.options.callback
    }

    /* USER */
    // showUser - get user info with username or user id
    // input - valid username or user id
    // output - json (as promise)
    // Example: showUser 'your_username', (json) ->
    showUser(input) {
    	this.options.path = `${this.options.endpoint}/user/show.xml?key=${this.options.key}&`
    	if(parseInt(input) > 1000){
    		this.options.path += `id=${input}`
    	} else {
      	this.options.path += `username=${username}`
    	}
      return new Promise((resolve, reject) => {
      	this.getRequest().then(e => resolve(e.GoodreadsResponse.user[0]), reject)
      })
    }
    
    /* BOOK */
    // showBook - get book info with title or ISBN
    // Input: goodreadsBookId
    // Outpt: json (as promise)
    showBook(input) {
    	this.options.path = `${this.options.endpoint}/book/show.xml?key=${this.options.key}&id=${input}`
    	return new Promise((resolve, reject) => {
    		this.getRequest().then(e => resolve(e.GoodreadsResponse.book[0]), reject)
    	})
    }

    /* AUTHORS AND SERIES LIST OF BOOKS */

    // getAuthor - Get paginated list of books for a given author
    // Input: authorId, page
    // Output: json (as promise)
    // Example: getAuthor '18541', 2, (json) ->
    getAuthor(authorId, page) {
      // Provide path to the API
      this.options.path = `${this.options.endpoint}/author/list/${authorId}?key=${this.options.key}&page=${page}`
      return new Promise((resolve, reject) => {
      	this.getRequest().then(e => resolve(e.GoodreadsResponse.author[0]), reject)
      })
    }

    // getSeries - Get all books in a given series
    // Input: seriesId
    // Output: json (as promise)
    // Example: getSeries '40650', (json) ->
    getSeries(seriesId) {
      // Provide path to the API
      this.options.path = `${this.options.endpoint}/series/${seriesId}?key=${this.options.key}`
      return new Promise((resolve, reject) => {
      	this.getRequest().then(e => resolve(e.GoodreadsResponse.series[0]), reject)
      })
    }

    /* BOOKSHELVES */

    // getShelves - Get all shelves for a given user
    // Input: userId
    // Output: json (as promise)
    // Example: getShelves '4085451', (json) ->
    getShelves(userId, callback) {
      // Provide path to the API
      this.options.path = `${this.options.endpoint}/shelf/list.xml?user_id=${userId}&key=${this.options.key}`
      return new Promise((resolve, reject) => {
      	this.getRequest().then(e => resolve(e.GoodreadsResponse.shelves[0]), reject)
      })
    }

    // getSingleShelf - Get a specific list by ID
    // Input: userId, listId
    // Output: json (as callback)
    // Example: getSingleShelf '4085451', 'web', (json) ->
    getSingleShelf(shelfOptions) {
      shelfOptions.key = this.options.key
      let {userID} = shelfOptions
      delete shelfOptions.userID
      if ("accessToken" in shelfOptions) {
        this.oauthAccessToken = shelfOptions.accessToken
        this.oauthAcessTokenSecret = shelfOptions.accessTokenSecret
        delete shelfOptions.accessToken
        delete shelfOptions.accessTokenSecret
      }
      this.options.path = `${this.options.endpoint}/review/list/${userID}.xml?${querystring.stringify(shelfOptions)}`;
      if (this.oauthAccessToken) {
        return this.getProtectedRequest().then(result => result.books[0].book)
      } else {
        return this.getRequest().then(result => result.GoodreadsResponse.books[0].book)
      }
    }
        

    // getFriends - Get friends for a given user
    // Input: userId, accessToken, accessTokenSecret
    // Output: json (as callback) [{"$":{"start":"1","end":"30","total":"78"},"user":[{"id":["7324227"],"name":["Becca Christensen"],"link":["http://www.goodreads.com/user/show/7324227-becca-christensen"]...
    // Example: getSingleShelf '4085451', 'asjdfklac23414', '1234jkmk1m100', (json) ->
    getFriends(userId, accessToken, accessTokenSecret) {
      // Provide path to the API
      this.options.path = `${this.options.endpoint}/friend/user/${userId}?format=xml`;
      this.oauthAccessToken = accessToken;
      this.oauthAcessTokenSecret = accessTokenSecret;
      return new Promise((resolve, reject) => {
      	this.getProtectedRequest().then(e => resolve(e.friends[0].user), reject)
      })
    }

    /* Search */
    // searchBooks
    // q: search value
    // Output: json (as promise)
    // Example: searchBooks 'Enders Game', (json) ->
    searchBooks(q) {
      this.options.path = `${this.options.endpoint}/search/index.xml?key=${this.options.key}&q=${encodeURI(q)}`;
      return new Promise((resolve, reject) => {
      	this.getRequest().then(e => resolve(e.GoodreadsResponse.search[0].results[0].work), reject)
      })
    }

		// getBook
		// params: {title, author}
		// Output: json (as promise)
		getBook({title, author}) {
			this.options.path = `${this.options.endpoint}/book/title.xml?key=${this.options.key}`
			this.options.path += `&title=${encodeURI(title || "")}`
			this.options.path += `&author=${encodeURI(author || "")}`
			return new Promise((resolve, reject) => {
				this.getRequest().then(e => resolve(e.GoodreadsResponse.book[0]), reject)
			})
		}
		
    /* OAUTH */

    // requestToken - calls back an object with oauthToken, oauthTokenSecret, and the URL!
    // Input: none
    // Output: json { oauthToken: 'iu1iojij14141411414', oauthTokenSecret: 'j1kljklsajdklf132141', url: 'http://goodreads.com/blah'}
    // Example: requestToken () ->
    requestToken() {
      return new Promise((resolve, reject) => {
        let oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption)

        oa.getOAuthRequestToken((error, oauthToken, oauthTokenSecret, results) => {
          if (error) {
            console.error(error)
            return reject(`Error getting OAuth request token : ${JSON.stringify(error)}`, 500);
          } else {
            // assemble goodreads URL
            let url = `https://goodreads.com/oauth/authorize?oauth_token=${oauthToken}&oauth_callback=${oa._authorize_callback}`
            return resolve({oauthToken, oauthTokenSecret, url})
          }
        })
      })
    }

    // processCallback - expects: oauthToken, oauthTokenSecret, authorize (from the query string)
    // Note: call this after requestToken!
    // Input: oauthToken, oauthTokenSecret, authorize
    // Output: json { 'username': 'Brad Dickason', 'userid': '404168', 'success': 1, 'accessToken': '04ajdfkja', 'accessTokenSecret': 'i14k31j41jkm' }
    // Example: processCallback oauthToken, oauthTokenSecret, params.query.authorize, (callback) ->

    processCallback(oauthToken, oauthTokenSecret, authorize) {
      return new Promise((resolve, reject) => {
        let oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption)
        oa.getOAuthAccessToken(oauthToken, oauthTokenSecret, authorize, (error, oauthAccessToken, oauthAccessTokenSecret, results) => {
          let parser = new xml2js.Parser()
          if (error) {
            reject(`Error getting OAuth access token : ${utils.inspect(error)}[${oauthAccessToken}] [${oauthAccessTokenSecret}] [${utils.inspect(results)}]`, 500)
          } else {
            oa.get('http://www.goodreads.com/api/auth_user', oauthAccessToken, oauthAccessTokenSecret, (error, data, response) => {
              if (error) {
                reject(`Error getting User ID : ${utils.inspect(error)}`, 500)
              } else {
                return parser.parseString(data)
              }
            })
          }
  
          return parser.on('end', result => {
            result = result.GoodreadsResponse // Object is now getting this in front of the object
            if (result.user[0]['$'].id !== null) {
              resolve({ 'username': result.user[0].name[0], 'userid': result.user[0]['$'].id, 'success': 1, 'accessToken': oauthAccessToken, 'accessTokenSecret': oauthAccessTokenSecret })
            } else {
              reject('Error: Invalid XML response received from Goodreads', 500)
            }
          })
        })
      })
      
    }
          
    // showAuthUser - get the user currently authenticated via oauth (for testing)
    // Note: call only after oauth
    // Input: oauthAccessToken, oauthAccessTokenSecret
    // Output: json {"$":{"id":"4085451"},"name":["your name"],"link":["http://www.goodreads.com/user/show/4085451-yourname?utm_medium=api"]}
    // Example: showAuthUser fakeSession.accessToken, fakeSession.accessTokenSecret, (json) ->
  
    showAuthUser(accessToken, accessTokenSecret) {
      return new Promise((resolve, reject) => {
        let oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption)
        let parser = new xml2js.Parser()
        oa.get(`${this.options.endpoint}/api/auth_user`, accessToken, accessTokenSecret, (error, data, response) => {
          if (error) {
            reject(`Error getting OAuth request token : ${JSON.stringify(error)}`, 500)
          } else {
            return parser.parseString(data)
          }
        })
        parser.on('end', result => {
          result = result.GoodreadsResponse // Object is now getting this in front of the object
          if (result.user[0] !== null) {
            resolve(result.user[0])
          } else {
            reject('Error: Invalid XML response received from Goodreads', 500)
          }
        })
      })
    }

    /* API: 'GET' */
    getRequest() {
      return new Promise((resolve, reject) => {
        let _options = this.options
        let tmp = []  // Russ at the NYC NodeJS Meetup said array push is faster
        let parser = new xml2js.Parser()
  
        return http.request(_options, function(res) {
          res.setEncoding('utf8')
          res.on('data', chunk => tmp.push(chunk))  // Throw the chunk into the array
          res.on('end', e => {
            let body = tmp.join('')
            return parser.parseString(body)
          })
  
          return parser.on('end', result => {resolve(result)})
        }).end()
      })
    }
   
    getProtectedRequest() {
    	return new Promise((resolve, reject) => {
    		let oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption)
	      let parser = new xml2js.Parser()
	      oa.get(this.options.path, this.oauthAccessToken, this.oauthAcessTokenSecret, (error, data, response) => {
	        if (error) {
	          reject(`Error getting OAuth request token : ${JSON.stringify(error)}`, 500)
	        } else {
	          return parser.parseString(data)
	        }
	      });
	      parser.on('end', result => {
	        result = result.GoodreadsResponse; // Object is now getting this in front of the object
	        if (result !== null) {
	          resolve(result)
	        } else {
	          reject('Error: Invalid XML response received from Goodreads', 500)
	        }
	      })
    	})
    }
  };
  Goodreads.initClass();
  return Goodreads;
})();

// Creates and returns a new Goodreads client.
exports.default = {
  client(options) {
  	return new Goodreads(options)
  }
}