//Tracking
(function(){
	var _gaq = _gaq || [];
	_gaq.push(['plugplus._setAccount', 'UA-32685589-1']);
	_gaq.push(['plugplus._trackPageview']);
})();//Hidden anonymous calls.


/**
 * This is the interface that is injected by PlugPlus to
 * run on the page. It has access to plug.dj javascript
 * and can listen to the plug.dj events. It will request
 * the settings from PlugPlus once.
 */
PlugPlusApp = function(){
	this.settings = JSON.parse(localStorage['PlugPlusSettings']);
	
	/* Events */
	this.setupEvents();

	var scope = this;

	setTimeout(function(){
		scope.setupPlugList();
	}, 10000);
	
	setTimeout(function(){
		//Trip auto functions a little after startup.
		scope.autoWoot();
		scope.autoJoin();
	}, 5000);

	$('#plugPlusList #refresh').click(function(){
		scope.setupPlugList();
	});
	
	//Setup channel
	
	var channel = new MessageChannel();
	
	window.postMessage("PlugPlusAppReady", "http://plug.dj",[channel.port2]);
	
	this.port = channel.port1;//TODO Finish channels

	/* Init */
	if (FB != "undefined")//If FB is not ready, it will take care of this anyways.
		FB.XFBML.parse();//Setup Plug Comments
	//TODO Remove this when we change chat to the new version.
};
PlugPlusApp.prototype = {

		constructor : PlugPlusApp,

		fireEvent : function(type, data){
			try{
				var eventData = {from: "plugPlusApp", type:type, data:data};
				window.postMessage(eventData, "http://plug.dj/*");
			}catch(e){
				console.error("PlugPlusApp: An error has occured!", e);
			}
		},
		
		notify : function(title, image, text){
			this.fireEvent("notify", {title: title, image: image, text: text});
		},

		handlePlugPlusEvent : function(data){
			var data = data.data;
			if (data.from != "plugPlus") return;
			switch(data.type){
			case "settingsChange":
				this.settings = JSON.parse(localStorage['PlugPlusSettings']);
				this.autoWoot();
				this.autoJoin();
				break;
			default: console.warn("PlugPlusApp: Something may have gone wrong,",data);
			}
		},

		setupEvents : function(){
			var scope = this;
			//Plug Plus listeners
			try{
				window.addEventListener("message", function(data){scope.handlePlugPlusEvent(data)});
			}catch(e){
				console.warn("PlugPlusApp: An error occured setting up the event listener. Some features may not work!", e);
			}

			//Plug.dj listeners
			API.on(API.DJ_ADVANCE, function(obj){
				scope.autoWoot();
				scope.songUpdate(obj);
				scope.updateRoomStats();
				scope.fireEvent(type, data)
			});
			API.on(API.DJ_UPDATE, function(){
				scope.autoJoin();
				
				setTimeout(function(){
					scope.autoJoin();
				}, 2000);//Possible fix for autojoin not working.
				
			});
			API.on(API.VOTE_UPDATE, function(obj){
				scope.userVote(obj);
				scope.updateRoomStats();
			});
			API.on(API.WAIT_LIST_UPDATE, function(){
				scope.updateRoomStats();
			});
			API.on(API.USER_JOIN, function(obj){
				scope.updateRoomStats();
			});
			API.on(API.USER_LEAVE, function(obj){
				scope.updateRoomStats();
			});

		},

		autoWoot : function(){
			if (this.settings.autoWoot){
				setTimeout(function(){
					$('#button-vote-positive').click();
				}, this.settings.autoWootDelay * 1000);
			}
		},

		autoJoin : function(){
			if (this.settings.autoJoin){
				var b = $('#button-dj-play:visible');
				if (b.size() != 0){
					b.click();
				} else if (API.getWaitList().length < 50){
					API.djJoin();
				} else {
					API.chatLog("Plug+: Waitlist is unavailable/full. Autojoin will not work.");
				}
			}
		},

		songUpdate : function(obj){

			$('#plugPlusListArea div').removeClass('woot meh');
			
			switch(this.settings.songUpdate){
			case 0: break;//Skip
			case 1: if (obj.dj.relationship <= 2) break;
			case 2: this.notify("Song Update", PlugPlusApp.urls.youtube(obj.media.cid), text);
				break;
			default: console.warn("Plug+: A setting has a value that has no association. Something bad might have happened.");
			}

		},

		djUpdate : function(obj){

		},

		userJoin : function(obj){

			var u = obj.user;
			var user = new ListUser(u.id, u.username, u.permission, you, u.relationship, u.vote);
			$('#plugPlusListArea').append(user.getDOM());

		},

		userLeave : function(obj){

			this.getUser(obj.user.id).remove();

		},

		userVote : function(obj){

			var vote = (obj.vote == 1) ? "woot" : "meh";

			$("#" + obj.user.id).removeClass('woot meh').addClass(vote);

		},

		updateRoomStats : function(){
			var userCount = API.getUsers().length;
			var waitListLength = API.getWaitList().length;
			var waitListPosition = API.getWaitListPosition();
			var roomVotes = API.getRoomScore();
			var percent = (.5 + ((roomVotes.positive/(userCount-1)) - (roomVotes.negative/(userCount-1))) *.5 ) * 100;
			//50% + (Positive Votes Percent - Negative Votes Percent)*50% with the dj taken out of the total since he cant vote. 

			$('#plugUsers').text(userCount);

			if (waitListPosition != -1){
				$('#plugWaitList').text(waitListPosition + "/" + waitListLength);
			} else {
				$('#plugWaitList').text(waitListLength);
			}

			$('#plugSongStats').text(percent.toPrecision(5) + "%");


		},

		setupPlugList : function(){

			var you = API.getUser().id;

			var listArea = $('#plugPlusListArea');
			var users = API.getUsers();

			listArea.text("");//Clear

			for (var i = 0; i<users.length; ++i){

				var u = users[i];
				var user = new ListUser(u.id, u.username, u.permission, you, u.relationship, u.vote);

				listArea.append(user.getDOM());

			}

		},

		getUser : function(id){

			return $('#' + id);

		}
};
PlugPlusApp.urls = {
		youtube : function(id) {
			return "http://img.youtube.com/vi/" + id + "/default.jpg";
		},
		plug : function(id){
			
		}
};

ListUser = function(id, name, permission, you, relation, vote){
	this.id = id;
	this.name = name;
	this.isMod = (permission>1);
	this.isYou = (id == you);
	this.relation = relation;
	this.vote = vote;
};
ListUser.prototype.constructor = ListUser;
ListUser.prototype.getDOM = function(){

	var element = document.createElement('div');
	var je = $(element);

	je.attr('id', this.id);
	je.text(this.name);

	if (this.relation > 2){
		je.addClass('friend');
	} else if (this.relation > 0){
		je.addClass('fan');
	}

	if (this.isMod){
		je.addClass('mod');
	}

	if (this.isYou){
		je.addClass('you');
	}

	if (this.vote == 1){
		je.addClass('woot');
	} else if (this.vote == -1){
		je.addClass('meh');
	}

	return element;

};



//TODO Make anonymous.
var plugplus = new PlugPlusApp();
