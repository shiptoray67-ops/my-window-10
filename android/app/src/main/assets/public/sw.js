/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "3a9c35989674c87d140d3f1175e7003e"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b9e327ccd3a26adf1d9cb4d4d7ac8d6b"
  }, {
    "url": "pwa-192x192.png",
    "revision": "cb4250a9e15d7b8e0bb295dacf32b2c1"
  }, {
    "url": "index.html",
    "revision": "9dcdfadadb40be6e4010359b70b44313"
  }, {
    "url": "icon.svg",
    "revision": "a419d39011eb46dfd5b325b37f215121"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "17308abfd9a7b47b9306c9d2ba4b49fb"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/win10_hero_wallpaper_1794595376771-DSDLUjpw.jpg",
    "revision": null
  }, {
    "url": "assets/win10_fluent_waves_1794595377781-CqQszAlt.jpg",
    "revision": null
  }, {
    "url": "assets/win10_alpine_lockscreen_1794595377816-Cjde0xmk.jpg",
    "revision": null
  }, {
    "url": "assets/web-BD3AQWEi.js",
    "revision": null
  }, {
    "url": "assets/web-35RUVAEA.js",
    "revision": null
  }, {
    "url": "assets/user_profile_avatar_1794595378912-Bomrg-9h.jpg",
    "revision": null
  }, {
    "url": "assets/sample_coastal_photo_1794595378663-C5AdPQOR.jpg",
    "revision": null
  }, {
    "url": "assets/index-G78wGZhP.css",
    "revision": null
  }, {
    "url": "assets/index-C54nJ6tC.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "17308abfd9a7b47b9306c9d2ba4b49fb"
  }, {
    "url": "icon.svg",
    "revision": "a419d39011eb46dfd5b325b37f215121"
  }, {
    "url": "pwa-192x192.png",
    "revision": "cb4250a9e15d7b8e0bb295dacf32b2c1"
  }, {
    "url": "pwa-512x512.png",
    "revision": "b9e327ccd3a26adf1d9cb4d4d7ac8d6b"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "3a9c35989674c87d140d3f1175e7003e"
  }, {
    "url": "manifest.webmanifest",
    "revision": "82a2cbf06badc806d7c4ea2e18854912"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
