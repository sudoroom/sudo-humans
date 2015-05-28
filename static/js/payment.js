
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

  $('#paymentForm').submit(function(e) {
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
        alert("TODO handle error: " + resp.error.message);
        return;      
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
