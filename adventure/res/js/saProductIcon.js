$('.preset-icon').click(function(event) {
    $('.preset-icon').removeClass("selected");
    $(this).addClass("selected");
    $('#presetName').val($(this).data("preset-name"));
    $('#new-icon').attr('src', $(this).attr("src"));
});
function iconReadURL(input) {
    if (input.files && input.files[0]) {
    var reader = new FileReader();
    console.log("readin");
    reader.onload = function (e) {
    $('#new-icon')
    .attr('src', e.target.result);
    };
                
    reader.readAsDataURL(input.files[0]);
    }
    $('.preset-icon').removeClass("selected");
    $('#presetName').val('');
}
