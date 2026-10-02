import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';

const SPLASH_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>MovieFlix</title>
<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  html, body {
    height: 100%;
    width: 100%;
    background: #000000;
    overflow: hidden;
    position: fixed;
    touch-action: none;
    overscroll-behavior: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  body {
    transition: opacity 0.25s ease;
    opacity: 1;
  }
  .stage {
    width: 88vw;
    max-width: 440px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stage svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
</style>
</head>
<body>

  <div class="stage">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="72 -26 2048 472" width="1024" height="236" role="img" aria-label="MovieFlix" xmlns:c2pa="http://c2pa.org/manifest"><title>MovieFlix</title><style>#logo path,#logo g{opacity:1;}#logo{animation:out 4.2s linear infinite both}@keyframes out{0%,85.714%{opacity:1;transform:translateY(0);animation-timing-function:cubic-bezier(.5,0,.8,.4)}94.286%,100%{opacity:0;transform:translateY(14px)}}#logo path,#logo g{transform-box:fill-box}@keyframes aL{0%,2.143%{transform:scaleY(0);animation-timing-function:cubic-bezier(.22,.8,.24,1)}12.143%,100%{transform:scaleY(1)}}.mL{transform-origin:50% 100%;animation:aL 4.2s infinite both}@keyframes aR{0%,4.286%{transform:scaleY(0);animation-timing-function:cubic-bezier(.22,.8,.24,1)}14.286%,100%{transform:scaleY(1)}}.mR{transform-origin:50% 100%;animation:aR 4.2s infinite both}@keyframes aB{0%,6.429%{opacity:0;transform:translate(-70px,-110px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}16.429%,100%{opacity:1;transform:translate(0,0)}}.mB{animation:aB 4.2s infinite both}@keyframes aM{0%,8.571%{opacity:0;transform:translate(70px,-110px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}18.571%,100%{opacity:1;transform:translate(0,0)}}.mM{animation:aM 4.2s infinite both}@keyframes a0{0%,11.429%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}22.143%,100%{opacity:1;transform:translateY(0)}}.l0{animation:a0 4.2s infinite both}@keyframes a1{0%,13.143%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}23.857%,100%{opacity:1;transform:translateY(0)}}.l1{animation:a1 4.2s infinite both}@keyframes a2{0%,14.857%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}25.571%,100%{opacity:1;transform:translateY(0)}}.l2{animation:a2 4.2s infinite both}@keyframes a3{0%,16.571%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}27.286%,100%{opacity:1;transform:translateY(0)}}.l3{animation:a3 4.2s infinite both}@keyframes a4{0%,18.286%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}29.0%,100%{opacity:1;transform:translateY(0)}}.l4{animation:a4 4.2s infinite both}@keyframes a5{0%,20.0%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}30.714%,100%{opacity:1;transform:translateY(0)}}.l5{animation:a5 4.2s infinite both}@keyframes a6{0%,21.714%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}32.429%,100%{opacity:1;transform:translateY(0)}}.l6{animation:a6 4.2s infinite both}@keyframes a7{0%,23.429%{opacity:0;transform:translateY(56px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}34.143%,100%{opacity:1;transform:translateY(0)}}.l7{animation:a7 4.2s infinite both}@keyframes aXD{0%,31.429%{opacity:0;transform:translate(-90px,-170px);animation-timing-function:cubic-bezier(.22,.8,.24,1)}41.429%,100%{opacity:1;transform:translate(0,0)}}.xD{animation:aXD 4.2s infinite both}@keyframes sh{0%,45.714%{transform:translateX(0) skewX(0);opacity:0}46.429%{opacity:1}58.571%{opacity:1}59.286%,100%{transform:translateX(2300px);opacity:0}}.shine{animation:sh 4.2s cubic-bezier(.4,0,.3,1) infinite both}@media (prefers-reduced-motion:reduce){#logo *{opacity:1!important;transform:none!important;}.shine{display:none}}</style><defs>
<clipPath id="mClip"><path d="M131.0 14.0L228.9 14.0Q234.0 14.0 236.6 18.4L309.2 141.3Q312.0 146.0 314.5 141.1L375.5 19.0Q378.0 14.0 383.6 14.0L481.0 14.0Q490.0 14.0 490.0 23.0L490.0 397.0Q490.0 406.0 481.0 406.0L387.0 406.0Q378.0 406.0 378.0 397.0L378.0 271.0Q378.0 258.0 372.3 269.7L314.2 389.1Q306.0 406.0 298.0 389.0L239.7 265.1Q234.0 253.0 234.0 266.4L234.0 397.0Q234.0 406.0 225.0 406.0L131.0 406.0Q122.0 406.0 122.0 397.0L122.0 23.0Q122.0 14.0 131.0 14.0Z"/></clipPath>
<clipPath id="xClip"><path d="M1839.2 38.0L1903.8 38.0Q1909.0 38.0 1911.1 42.8L1945.3 120.9Q1948.0 127.2 1950.7 120.9L1984.9 42.8Q1987.0 38.0 1992.2 38.0L2056.8 38.0Q2069.0 38.0 2064.1 49.2L1989.5 219.8Q1989.0 221.0 1989.5 222.2L2064.1 392.8Q2069.0 404.0 2056.8 404.0L1992.2 404.0Q1987.0 404.0 1984.9 399.2L1950.7 321.1Q1948.0 314.8 1945.3 321.1L1911.1 399.2Q1909.0 404.0 1903.8 404.0L1839.2 404.0Q1827.0 404.0 1831.9 392.8L1906.5 222.2Q1907.0 221.0 1906.5 219.8L1831.9 49.2Q1827.0 38.0 1839.2 38.0Z"/></clipPath>
<clipPath id="logoClip"><path d="M131.0 14.0L228.9 14.0Q234.0 14.0 236.6 18.4L309.2 141.3Q312.0 146.0 314.5 141.1L375.5 19.0Q378.0 14.0 383.6 14.0L481.0 14.0Q490.0 14.0 490.0 23.0L490.0 397.0Q490.0 406.0 481.0 406.0L387.0 406.0Q378.0 406.0 378.0 397.0L378.0 271.0Q378.0 258.0 372.3 269.7L314.2 389.1Q306.0 406.0 298.0 389.0L239.7 265.1Q234.0 253.0 234.0 266.4L234.0 397.0Q234.0 406.0 225.0 406.0L131.0 406.0Q122.0 406.0 122.0 397.0L122.0 23.0Q122.0 14.0 131.0 14.0Z"/><path fill-rule="evenodd" d="M584 34H692A66 66 0 0 1 758 100V322A66 66 0 0 1 692 388H584A66 66 0 0 1 518 322V100A66 66 0 0 1 584 34ZM626 102H650A20 20 0 0 1 670 122V298A20 20 0 0 1 650 318H626A20 20 0 0 1 606 298V122A20 20 0 0 1 626 102Z"/><path d="M769.9 38.0L835.5 38.0Q842.0 38.0 843.3 44.4L875.1 197.8Q878.0 212.0 880.9 197.8L912.7 44.4Q914.0 38.0 920.5 38.0L986.0 38.0Q996.0 38.0 993.8 47.8L923.4 360.8Q922.0 367.0 915.6 367.0L838.4 367.0Q832.0 367.0 830.6 360.7L762.1 47.7Q760.0 38.0 769.9 38.0Z"/><path d="M1020.0 38.0L1092.0 38.0Q1099.0 38.0 1099.0 45.0L1099.0 348.0Q1099.0 355.0 1092.0 355.0L1020.0 355.0Q1013.0 355.0 1013.0 348.0L1013.0 45.0Q1013.0 38.0 1020.0 38.0Z"/><path d="M1130.0 38.0L1302.0 38.0Q1309.0 38.0 1309.0 45.0L1309.0 92.0Q1309.0 99.0 1302.0 99.0L1212.0 99.0Q1209.0 99.0 1209.0 102.0L1209.0 154.0Q1209.0 157.0 1212.0 157.0L1278.0 157.0Q1285.0 157.0 1285.0 164.0L1285.0 212.0Q1285.0 219.0 1278.0 219.0L1212.0 219.0Q1209.0 219.0 1209.0 222.0L1209.0 291.0Q1209.0 294.0 1212.0 294.0L1305.0 294.0Q1312.0 294.0 1312.0 301.0L1312.0 348.0Q1312.0 355.0 1305.0 355.0L1130.0 355.0Q1123.0 355.0 1123.0 348.0L1123.0 45.0Q1123.0 38.0 1130.0 38.0Z"/><path d="M1341.0 38.0L1509.0 38.0Q1516.0 38.0 1516.0 45.0L1516.0 92.0Q1516.0 99.0 1509.0 99.0L1423.0 99.0Q1420.0 99.0 1420.0 102.0L1420.0 154.0Q1420.0 157.0 1423.0 157.0L1486.0 157.0Q1493.0 157.0 1493.0 164.0L1493.0 212.0Q1493.0 219.0 1486.0 219.0L1423.0 219.0Q1420.0 219.0 1420.0 222.0L1420.0 348.0Q1420.0 355.0 1413.0 355.0L1341.0 355.0Q1334.0 355.0 1334.0 348.0L1334.0 45.0Q1334.0 38.0 1341.0 38.0Z"/><path d="M1541.0 38.0L1613.0 38.0Q1620.0 38.0 1620.0 45.0L1620.0 300.0Q1620.0 303.0 1623.0 303.0L1691.0 303.0Q1698.0 303.0 1698.0 310.0L1698.0 359.0Q1698.0 366.0 1691.0 366.0L1541.0 366.0Q1534.0 366.0 1534.0 359.0L1534.0 45.0Q1534.0 38.0 1541.0 38.0Z"/><path d="M1731.0 38.0L1803.0 38.0Q1810.0 38.0 1810.0 45.0L1810.0 374.0Q1810.0 381.0 1803.0 381.0L1731.0 381.0Q1724.0 381.0 1724.0 374.0L1724.0 45.0Q1724.0 38.0 1731.0 38.0Z"/><path d="M1839.2 38.0L1903.8 38.0Q1909.0 38.0 1911.1 42.8L1945.3 120.9Q1948.0 127.2 1950.7 120.9L1984.9 42.8Q1987.0 38.0 1992.2 38.0L2056.8 38.0Q2069.0 38.0 2064.1 49.2L1989.5 219.8Q1989.0 221.0 1989.5 222.2L2064.1 392.8Q2069.0 404.0 2056.8 404.0L1992.2 404.0Q1987.0 404.0 1984.9 399.2L1950.7 321.1Q1948.0 314.8 1945.3 321.1L1911.1 399.2Q1909.0 404.0 1903.8 404.0L1839.2 404.0Q1827.0 404.0 1831.9 392.8L1906.5 222.2Q1907.0 221.0 1906.5 219.8L1831.9 49.2Q1827.0 38.0 1839.2 38.0Z"/></clipPath>
<linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs><g id="logo">
<g clip-path="url(#mClip)">
<path class="mL" fill="#B20000" d="M122 14L234 14L234 406L122 406Z"/>
<path class="mR" fill="#B20000" d="M378 14L490 14L490 406L378 406Z"/>
<path class="mM" fill="#CA0000" d="M378 14L490 14L378 258L300 258L300 158L312 146Z"/>
<path class="mB" fill="#F10405" d="M122 14L234 14L378 258L306 406Z"/>
</g>
<path class="l0" fill="#D40000" fill-rule="evenodd" d="M584 34H692A66 66 0 0 1 758 100V322A66 66 0 0 1 692 388H584A66 66 0 0 1 518 322V100A66 66 0 0 1 584 34ZM626 102H650A20 20 0 0 1 670 122V298A20 20 0 0 1 650 318H626A20 20 0 0 1 606 298V122A20 20 0 0 1 626 102Z"/>
<path class="l1" fill="#D40000" d="M769.9 38.0L835.5 38.0Q842.0 38.0 843.3 44.4L875.1 197.8Q878.0 212.0 880.9 197.8L912.7 44.4Q914.0 38.0 920.5 38.0L986.0 38.0Q996.0 38.0 993.8 47.8L923.4 360.8Q922.0 367.0 915.6 367.0L838.4 367.0Q832.0 367.0 830.6 360.7L762.1 47.7Q760.0 38.0 769.9 38.0Z"/>
<path class="l2" fill="#D40000" d="M1020.0 38.0L1092.0 38.0Q1099.0 38.0 1099.0 45.0L1099.0 348.0Q1099.0 355.0 1092.0 355.0L1020.0 355.0Q1013.0 355.0 1013.0 348.0L1013.0 45.0Q1013.0 38.0 1020.0 38.0Z"/>
<path class="l3" fill="#D40000" d="M1130.0 38.0L1302.0 38.0Q1309.0 38.0 1309.0 45.0L1309.0 92.0Q1309.0 99.0 1302.0 99.0L1212.0 99.0Q1209.0 99.0 1209.0 102.0L1209.0 154.0Q1209.0 157.0 1212.0 157.0L1278.0 157.0Q1285.0 157.0 1285.0 164.0L1285.0 212.0Q1285.0 219.0 1278.0 219.0L1212.0 219.0Q1209.0 219.0 1209.0 222.0L1209.0 291.0Q1209.0 294.0 1212.0 294.0L1305.0 294.0Q1312.0 294.0 1312.0 301.0L1312.0 348.0Q1312.0 355.0 1305.0 355.0L1130.0 355.0Q1123.0 355.0 1123.0 348.0L1123.0 45.0Q1123.0 38.0 1130.0 38.0Z"/>
<path class="l4" fill="#D40000" d="M1341.0 38.0L1509.0 38.0Q1516.0 38.0 1516.0 45.0L1516.0 92.0Q1516.0 99.0 1509.0 99.0L1423.0 99.0Q1420.0 99.0 1420.0 102.0L1420.0 154.0Q1420.0 157.0 1423.0 157.0L1486.0 157.0Q1493.0 157.0 1493.0 164.0L1493.0 212.0Q1493.0 219.0 1486.0 219.0L1423.0 219.0Q1420.0 219.0 1420.0 222.0L1420.0 348.0Q1420.0 355.0 1413.0 355.0L1341.0 355.0Q1334.0 355.0 1334.0 348.0L1334.0 45.0Q1334.0 38.0 1341.0 38.0Z"/>
<path class="l5" fill="#D40000" d="M1541.0 38.0L1613.0 38.0Q1620.0 38.0 1620.0 45.0L1620.0 300.0Q1620.0 303.0 1623.0 303.0L1691.0 303.0Q1698.0 303.0 1698.0 310.0L1698.0 359.0Q1698.0 366.0 1691.0 366.0L1541.0 366.0Q1534.0 366.0 1534.0 359.0L1534.0 45.0Q1534.0 38.0 1541.0 38.0Z"/>
<path class="l6" fill="#D40000" d="M1731.0 38.0L1803.0 38.0Q1810.0 38.0 1810.0 45.0L1810.0 374.0Q1810.0 381.0 1803.0 381.0L1731.0 381.0Q1724.0 381.0 1724.0 374.0L1724.0 45.0Q1724.0 38.0 1731.0 38.0Z"/>
<g class="l7">
<path fill="#DC0000" d="M1839.2 38.0L1903.8 38.0Q1909.0 38.0 1911.1 42.8L1945.3 120.9Q1948.0 127.2 1950.7 120.9L1984.9 42.8Q1987.0 38.0 1992.2 38.0L2056.8 38.0Q2069.0 38.0 2064.1 49.2L1989.5 219.8Q1989.0 221.0 1989.5 222.2L2064.1 392.8Q2069.0 404.0 2056.8 404.0L1992.2 404.0Q1987.0 404.0 1984.9 399.2L1950.7 321.1Q1948.0 314.8 1945.3 321.1L1911.1 399.2Q1909.0 404.0 1903.8 404.0L1839.2 404.0Q1827.0 404.0 1831.9 392.8L1906.5 222.2Q1907.0 221.0 1906.5 219.8L1831.9 49.2Q1827.0 38.0 1839.2 38.0Z"/>
<g clip-path="url(#xClip)"><path class="xD" fill="#B30000" d="M1989 221L2069 404L1987 404L1948 314.788Z"/></g>
</g>
<g clip-path="url(#logoClip)"><rect class="shine" x="60" y="-40" width="260" height="520" fill="url(#shine)" transform="skewX(-18)"/></g>
</g></svg>
  </div>

  <script>
    var isDone = false;
    function finishSplash() {
      if (isDone) return;
      isDone = true;
      document.body.style.opacity = '0';
      setTimeout(function() {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'finish' }));
        }
      }, 250);
    }

    // Auto complete after 3.2s
    setTimeout(finishSplash, 3200);

    // Tap anywhere to skip
    document.body.addEventListener('click', function() {
      finishSplash();
    });

    // Prevent default gestures
    document.addEventListener('touchmove', function(e) {
      e.preventDefault();
    }, { passive: false });
  </script>
</body>
</html>`;

export default function CustomSplashScreen({ onFinish }) {
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'finish' && onFinish) {
        onFinish();
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />
      <WebView
        source={{ html: SPLASH_HTML }}
        style={styles.webview}
        containerStyle={styles.webview}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        textZoom={100}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
