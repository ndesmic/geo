#!/usr/bin/env sh
#wrapper for deno webserver on mac/linux because playwright doesn't like to run it directly
deno run -A https://deno.land/std/http/file_server.ts