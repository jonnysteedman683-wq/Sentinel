#!/bin/bash
sed -n '1901,1926p' server.ts > temp_interaction_logs.txt
sed -i '1901,1926d' server.ts
sed -i '/async function startServer() {/r temp_interaction_logs.txt' server.ts
rm temp_interaction_logs.txt
