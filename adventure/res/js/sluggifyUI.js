var updatableSlug = true;
/* jQuery because BS brings it in; trivial to remove */
function sluggify(str) {
    if (!str) {
        return "";
    }
    /* we could check for the existence of a slug too */
    return str.toLowerCase() /* no uppercase in slug */
        .replace(/[^a-z0-9-]/g, "-") /* get rid of non-alphanumerics/hyphen
					.replace(/--+/g, "-") /* get rid of doubled up hyphens */
        .replace(/-$/g, "") /* get rid of trailing hyphens */
        .replace(/^-/g, "") /* and leading ones too */;
}
function updateSlugMaybe(source) {
    if (updatableSlug) {
        $("#slug").val(sluggify($(source).val()))
    }
}
/* if the slug box has its own value entered, don't overwrite */
function slugBlur(source) {
    /* is the slug empty, or is the same as a sluggified name? if so, make it changeable */
    var val = $(source).val();
    updatableSlug = !val || (sluggify($("#name").val()) == val);
}