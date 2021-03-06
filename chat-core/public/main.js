$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $banishButton = $('.banish-button');

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  var latestUser = "";
  var latestMessage = "";

  const addParticipantsMessage = (data) => {
    var message = '';
    if (data.numUsers === 1) {
      message += "1 Participant Online";
    } else {
      message += data.numUsers + " Participants Online";
    }
    document.title = "Nameless Chatroom ("+ data.numUsers +")";
    document.getElementById("participant-number").innerHTML = (data.numUsers == 1)?"1 Participant":(data.numUsers+" Participants");
    log(message);
  }

  // Sets the client's username
  const setUsername = () => {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
      document.getElementById("current-username").innerHTML = username;
    }
  }

  // Sends a chat message
  const sendMessage = () => {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
    const log = (message, options) => {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  const addChatMessage = (data, options) => {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);
    latestUser = data.username;
    latestMessage = data.message;

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  const addChatTyping = (data) => {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  const removeChatTyping = (data) => {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  const addMessageElement = (el, options) => {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  const cleanInput = (input) => {
    return $('<div/>').text(input).html();
  }

  // Updates the typing event
  const updateTyping = () => {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  const getTypingMessages = (data) => {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  const getUsernameColor = (username) => {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  const banishUser = (username) => {
    alert(username);
    socket.emit("expulsion", username);
  }

  // Keyboard events

  $window.keydown(event => {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', () => {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(() => {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(() => {
    $inputMessage.focus();
  });


  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', (data) => {
    connected = true;
    // Display the welcome message
    var message = "Welcome to the Nameless Chat";
    log(message, {
      prepend: true
    });
    document.getElementById("userlist-content").innerHTML = "";
    var userlist_array = data.userlist.split(", ");
    for (i = userlist_array.length-1; i >= 0; i--)
      if (userlist_array[i].trim() == '')
        userlist_array.splice(i, 1);
      else
        break;
    /*
    var banishOptionString = "";
    banishOptionString += "Banish a User: <select class=\"banishButton\">";
    banishOptionString += "<option value=\"\">Select a User to Banish</option>";
    for (i = 0; i < userlist_array.length; i++)
      banishOptionString += "<option value=\""+userlist_array[i]+"\">"+userlist_array[i]+"</option>";
    banishOptionString += "</select>";
    document.getElementById("userlist-content").innerHTML += banishOptionString;
    document.getElementsByClassName("banishButton")[0].addEventListener("change", function(){
      alert();
      banishUser(this.value);
    });
    */
    document.getElementById("userlist-content").innerHTML += "<ul type=\"disc\">";
    for (i = 0; i < userlist_array.length; i++)
      document.getElementById("userlist-content").innerHTML += "<li>"+userlist_array[i]+"</li>";
    $banishButton.click(() => {
      banishUser(this.correspondinguser);
    });
    document.getElementById("userlist-content").innerHTML += "</ul>";
    addParticipantsMessage(data);
  });

  socket.on('user list', (data) => {
    document.getElementById("userlist-content").innerHTML = "";
    var userlist_array = data.userlist.split(", ");
    for (i = userlist_array.length-1; i >= 0; i--)
      if (userlist_array[i].trim() == '')
        userlist_array.splice(i, 1);
      else
        break;
        document.getElementById("userlist-content").innerHTML += "<ul type=\"disc\">";
      for (i = 0; i < userlist_array.length; i++)
        document.getElementById("userlist-content").innerHTML += "<li>"+userlist_array[i]+"</li>";
      $banishButton.click(() => {
        banishUser(this.correspondinguser);
      });
      document.getElementById("userlist-content").innerHTML += "</ul>";
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', (data) => {
    addChatMessage(data);
    if (document.getElementById("notification-sound-setting").value == "true") {
      var ringtone_type = document.getElementById("ringtone-option").value;
      document.getElementById("ringtone"+"-"+ringtone_type+"-"+"player").play();
    }
    if (document.getElementById("notification-browser-setting").value == "true") {
      var notificationElement = new Notification("New Message", {
        icon: "icon1000x1000.png",
        body: latestUser+" says \""+latestMessage+"\""
      });
    }
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', (data) => {
    log(data.username + ' joined');
    if (document.getElementById("notification-browser-setting").value == "true") {
      var notificationElement = new Notification("New User", {
        icon: "icon1000x1000.png",
        body: data.username+" joined the nameless chatroom"
      });
    }
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', (data) => {
    log(data.username + ' left');
    if (document.getElementById("notification-browser-setting").value == "true") {
      var notificationElement = new Notification(data.username+" left", {
        icon: "icon1000x1000.png",
        body: data.username+" left the nameless chatroom"
      });
    }
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', (data) => {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', (data) => {
    removeChatTyping(data);
  });

  socket.on('disconnect', () => {
    log('Connection Lost');
    document.title = "Connection Lost - Nameless Chatroom";
    document.getElementById("participant-number").innerHTML = "Connection Lost";
    document.getElementsByClassName("inputMessage")[0].style.borderColor = "rgb(255, 0, 0)";
    document.getElementsByClassName("inputMessage")[0].disabled = true;
    document.getElementsByClassName("inputMessage")[0].placeholder = "Connection Lost";
  });

  socket.on('reconnect', (data) => {
    log('Connection Recovered');
    document.title = "Nameless Chatroom ("+ data.numUsers +")";
    document.getElementById("participant-number").innerHTML = (data.numUsers == 1)?"1 Participant":(data.numUsers+" Participants");
    document.getElementsByClassName("inputMessage")[0].style.borderColor = "rgb(0, 120, 215)";
    document.getElementsByClassName("inputMessage")[0].disabled = false;
    document.getElementsByClassName("inputMessage")[0].placeholder = "Your Message...";
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', () => {
    log('Connection Attempt Failed');
    document.title = "Connection Attempt Failed - Nameless Chatroom";
    document.getElementById("participant-number").innerHTML = "Connection Lost";
    document.getElementsByClassName("inputMessage")[0].style.borderColor = "rgb(255, 0, 0)";
    document.getElementsByClassName("inputMessage")[0].disabled = true;
    document.getElementsByClassName("inputMessage")[0].placeholder = "Connection Lost";
  });

  socket.on('expulsion', (data) => {
    if (data.banished_user == username) {
      log('Banished');
      document.title = "Banished - Nameless Chatroom";
      var alert_message = document.getElementById('alert-message');
      var span2 = document.getElementsByClassName("close")[0];
      var alert_content = document.getElementById("alert-content");
      var alert_title = document.getElementById("alert-title");
      alert_title.innerHTML = "Expulsion";
      alert_content.innerHTML = "You have been banished.";
      alert_message.style.display = "block";
      span2.addEventListener("click", function() {
          window.close();
      });
      window.addEventListener("click", function(event) {
          if (event.target == alert_message)
              window.close();
      });
    }
  });
});
