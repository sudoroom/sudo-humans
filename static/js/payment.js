
$(document).ready(function() {

  $('.js-only').removeClass('js-only');
  $('.no-js').css('display', 'none');

  $('#cancel').click(function(e) {
    var el = $('#cancelParent');
    var delay = 3;

    function waitCheck() {
      delay--;
      if(delay > 0) {
        el.html("Wait " + delay + " seconds");
        setTimeout(waitCheck, 1000);
      } else {
        var a = document.createElement("A");
        a.href = "#";
        a.innerHTML = "Click again to confirm that you really want to cancel your subscription.";
        el.html(a);

        $(a).click(function(e) {
          $("#cancelForm").submit();
        });
      }
    }
    delay++;
    waitCheck();

    return false;
  })

  var pubKey = $("#publishableKey").val();
  Stripe.setPublishableKey(pubKey);

  function formToObj(form) {
      var o = {};
      var a = $(form).serializeArray();
      $.each(a, function() {
          if (o[this.name] !== undefined) {
              if (!o[this.name].push) {
                  o[this.name] = [o[this.name]];
              }
              o[this.name].push(this.value || '');
          } else {
              o[this.name] = this.value || '';
          }
      });
      return o;
  }  

  function validationFail(msg) {
      $("#flash").html(msg);
      window.location = "#flash";
      return false;
  }

  $('#paymentForm').submit(function(e) {
      
      var o = formToObj("#paymentForm");

      if(!o.subscription_plan) {
          return validationFail("You must select a monthly subscription");
      }

      o.card_name = o.card_name.replace(/\s+/g, '');
      o.card_number = o.card_number.replace(/\s+/g, '');
      o.exp_month = o.exp_month.replace(/\s+/g, '');
      o.exp_year = o.exp_year.replace(/\s+/g, '');
      o.cvc = o.cvc.replace(/\s+/g, '');
/*
      if(o.card_name || o.card_number) {
          if(!o.card_name) {
              return validationFail("Cardholder name missing");
          }
          if(!o.card_number) {
              return validationFail("Card number missing");
          }
          if(!o.card_number.match(/[0-9]{16}/)) {
              return validationFail("Invalid credit card number");
          }
          if(!o.exp_month) {
              return validationFail("Expiration month missing");
          }
          if(!o.exp_month.match(/[0-9]{2}/)) {
              return validationFail("Invalid month");
          }
          if(!o.exp_year) {
              return validationFail("Expiration year missing");
          }
          if(!o.exp_year.match(/[0-9]{2}/)) {
              return validationFail("Invalid year. Should be two digits");
          }
          if(!o.cvc) {
              return validationFail("Card security code missing");
          }
          if(!o.cvc.match(/[0-9]{3}/)) {
              return validationFail("Invalid card security code");
          }
      } else {
          if(!o.is_subscribed) {
              return validationFail("You forgot to fill out your credit card information");
          }
      }
*/
      

    $('#saveButton').disabled = true;

    var form = $(this);

    if(!$("input[name=card_name]").val()) {
      // if the card name isn't filled, out, 
      // then we don't have a new credit card number
      // so just clear the fields and submit

      $(".creditcard input").val('');
      form.get(0).submit();
      return false;
    }
  
    Stripe.card.createToken(form, function(status, resp) {
      if(resp.error) {
        return validationFail(resp.error.message);
      }
      var token = resp.id;

      var lastTwoDigits = $("input[name=card_number]").val().slice(-2);

      $(".creditcard input").val('');

      form.append($('<input type="hidden" name="lastTwoDigits" />').val(lastTwoDigits));
      form.append($('<input type="hidden" name="stripeToken" />').val(token));

       form.get(0).submit();

    });
    return false;
  });


});
