#wrapper for deno webserver on windows because playwright doesn't like to run it directly
deno run -A https://deno.land/std/http/file_server.ts