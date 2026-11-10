const sharp=require('sharp'),fs=require('fs');
const base='android/app/src/main/res/';
const sizes={mdpi:[48,108],hdpi:[72,162],xhdpi:[96,216],xxhdpi:[144,324],xxxhdpi:[192,432]};
const xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n<background android:drawable="@color/ic_launcher_background"/>\n<foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>';
(async()=>{
  for(const [d,[s,f]] of Object.entries(sizes)){
    const dir=base+'mipmap-'+d+'/';
    fs.mkdirSync(dir,{recursive:true});
    await sharp('icon.svg',{density:300}).resize(s,s).png().toFile(dir+'ic_launcher.png');
    await sharp('icon.svg',{density:300}).resize(s,s).png().toFile(dir+'ic_launcher_round.png');
    await sharp('icon-fg.svg',{density:300}).resize(f,f).png().toFile(dir+'ic_launcher_foreground.png');
  }
  fs.mkdirSync(base+'mipmap-anydpi-v26',{recursive:true});
  fs.writeFileSync(base+'mipmap-anydpi-v26/ic_launcher.xml',xml);
  fs.writeFileSync(base+'mipmap-anydpi-v26/ic_launcher_round.xml',xml);
  fs.writeFileSync(base+'values/ic_launcher_background.xml','<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#121212</color></resources>');
})();
