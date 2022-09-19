<template lang="pug">
.test 
    p {{$gettext("Cancel")}}
    p {{$pgettext("some context", "Cancel")}}
    p {{$gettext("Cache for google maps")}}
    p {{$pgettext('gdpr', "Cache for google maps")}}
    p {{$npgettext("medium duration text", "day", "days", 1)}}
    p {{$npgettext("medium duration text 2", "day", "days", 1)}}
    p(:title="$gettext('Tag attribute')")
    p(:title="$pgettext('with context', 'Tag attribute with context')")
</template>

