#!/bin/bash

remote=
for arg; do
    [[ "$arg" =~ :.*/$ ]] && remote=$arg && continue
    case "$arg" in
        *) exit 1;;
    esac
done

[ "$remote" ] || exit 1

self=$(readlink -e "$0") || exit 1
self=$(dirname "${self}") || exit 1

rsync --inplace --delete --out-format="%t %o %f ... %n" --filter=". ${self}/rs-filter" -Phac "$remote" "${self}/../"
