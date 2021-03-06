/**
 * @fileoverview Request
 */

/**
 * @class Request
 * @param {SIP.Session} session
 */
(function(SIP) {

var Request = function(session) {
  var events = [
  'progress',
  'succeeded',
  'failed'
  ];

  this.owner = session;

  this.logger = session.ua.getLogger('sip.rtcsession.request', session.id);
  this.initEvents(events);
};
Request.prototype = new SIP.EventEmitter();


Request.prototype.send = function(method, options) {
  options = options || {};

  var event,
    extraHeaders = options.extraHeaders || [],
    eventHandlers = options.eventHandlers || {},
    body = options.body || null;

  if (method === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // Check Session Status
  if (this.owner.status !== SIP.Session.C.STATUS_1XX_RECEIVED &&
    this.owner.status !== SIP.Session.C.STATUS_WAITING_FOR_ANSWER &&
    this.owner.status !== SIP.Session.C.STATUS_WAITING_FOR_ACK &&
    this.owner.status !== SIP.Session.C.STATUS_CONFIRMED &&
    this.owner.status !== SIP.Session.C.STATUS_TERMINATED) {
    throw new SIP.Exceptions.InvalidStateError(this.owner.status);
  }

  /* Allow sending BYE in TERMINATED status (only if invitecontext is terminated before ACK arrives
   * RFC3261 Section 15, Paragraph 2
   */
  else if (this.owner.status === C.STATUS_TERMINATED && method !== SIP.C.BYE) {
    throw new SIP.Exceptions.InvalidStateError(this.owner.status);
  }
  // Set event handlers
  for (event in eventHandlers) {
    this.on(event, eventHandlers[event]);
  }

  this.owner.dialog.sendRequest(this, method, {
    extraHeaders: extraHeaders,
    body: body
  });
};

/**
 * @private
 */
Request.prototype.receiveResponse = function(response) {
  var cause;

  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      this.emit('progress', {
        originator: 'remote',
        response: response
      });
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      this.emit('succeeded', {
        originator: 'remote',
        response: response
      });
      break;

    default:
      cause = SIP.Utils.sipErrorCause(response.status_code);
      this.emit('failed', {
        originator: 'remote',
        response: response,
        cause: cause
      });
      break;
  }
};

/**
 * @private
 */
Request.prototype.onRequestTimeout = function() {
  this.emit('failed', {
    originator: 'system',
    cause: SIP.C.causes.REQUEST_TIMEOUT
  });
  this.owner.onRequestTimeout();
};

/**
 * @private
 */
Request.prototype.onTransportError = function() {
  this.emit('failed', {
    originator: 'system',
    cause: SIP.C.causes.CONNECTION_ERROR
  });
  this.owner.onTransportError();
};

/**
 * @private
 */
Request.prototype.onDialogError = function(response) {
  this.emit('failed', {
    originator: 'remote',
    response: response,
    cause: SIP.C.causes.DIALOG_ERROR
  });
  this.owner.onDialogError(response);
};

return Request;
}(SIP));
