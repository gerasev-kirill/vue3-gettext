<template lang="pug">
.test 
    h1 {{$gettext("Tag inner")}}
    p(:title="$gettext('Tag attribute')")
    p(:title="$pgettext('with context', 'Tag attribute with context')")
</template>


<script setup lang="ts">
function $gettext(text: string){

}

let gettext = {
    $gettext
};

$gettext("Other text!");
let text = gettext.$gettext("Text from setup");
</script>

