sed -i "s|found=found.filter(x=>!(x.duration<30000));|found=found.filter(x=>!(x.duration<30000));if(found[0])alert(JSON.stringify(found[0]));|" app.js
node --check app.js && echo "OK"
