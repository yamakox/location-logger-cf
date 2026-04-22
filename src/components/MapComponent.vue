<template>
  <div class="m-0 p-0 w-100">
    <div ref="map" class="__map"></div>
    <div ref="blinker" class="__blinker"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import L from 'leaflet';
import { openReverseGeocoder } from 'https://cdn.skypack.dev/@geolonia/open-reverse-geocoder@latest';
import { Geodesic } from 'geographiclib-geodesic';
import NoSleep from 'nosleep.js';

// スリープ抑止オブジェクト
const noSleep = new NoSleep();

// GeographicLibの2点間の距離を算出するオブジェクトの取得
const geod = Geodesic.WGS84;

// locate(auto=true)時の状態を格納するオブジェクト
const autoModeState = {
  auto: false, 
  lastLatitude: null, 
  lastLongitude: null, 
  lastUpdateTime: null, 
  minInterval: 60000,     // 単位: ミリ秒
  minDistance: 30,        // 単位: m(メートル)
};

// 定数
const defaultZoom = 15;

// プロパティの定義
const props = defineProps({
  latitude: {type: Number, default: 0.0}, 
  longitude: {type: Number, default: 0.0}, 
  zoom: {type: Number, default: 1}, 
});

// このコンポーネントから送出するイベントの定義
const emit = defineEmits(['locationFound']);

// mapオブジェクトを割り当てるdiv要素(名前はref属性の値と一致させる)
const map = ref();

// 点滅div要素
const blinker = ref();

// Leafletのmapオブジェクト
let __map = null;

// leafletのpolylineオブジェクト
let __path = null;

// Geolocation APIを使ってユーザーの位置を更新
function locate(auto=false) {
  if (__map === null || autoModeState.auto) { return; }
  console.log('locate');
  if (auto) {
    autoModeState.auto = true;
    autoModeState.lastLatitude = null;
    autoModeState.lastLongitude = null;
    autoModeState.lastUpdateTime = null;
    blinker.value.style.backgroundColor ='transparent';
    noSleep.enable();
  }
  __map.locate({
    watch: auto, 
    setView: !auto,     // autoの場合はビューを自動更新しない
    maxZoom: defaultZoom, 
    enableHighAccuracy: true, 
  });
}

// Geolocation APIの自動更新を停止
function stopLocate() {
  __map.stopLocate();
  noSleep.disable();
  autoModeState.auto = false;
  blinker.value.style.backgroundColor ='transparent';
}

// 指定された緯度経度の場所を表示
function showLocation(latitude, longitude, timestamp, address, distance) {
  __map.setView([latitude, longitude], __map.zoom);
  popupMessage(latitude, longitude, timestamp, address, distance);
}

// 位置情報の履歴に合わせて地図を表示
function setLatLngs(latlngs) {
  __path.setLatLngs(latlngs);
}

// 位置情報の履歴に表示範囲を合わせる
function fitLatLngs() {
  let bounds = __path.getBounds();
  if (bounds.isValid()) {
    __map.fitBounds(bounds);
  }
}

// プロパティの設定値に則って地図上の位置を更新
function updateLocation(latitude, longitude, zoom) {
  if (__map === null) { return; }
  console.log(`[updateLocation] ${latitude}, ${longitude}, ${zoom}`);
  __map.setView([latitude, longitude], zoom);
}

// 緯度経度の場所にメッセージをポップアップ表示する
function popupMessage(latitude, longitude, timestamp, address, distance = null) {
  // 日時文字列の取得
  let date = new Date(timestamp);
  let localTime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, -3);

  // 日時と住所のポップアップ表示
  let distMessage = '';
  if (distance != null) {
    distMessage = `<br>前回から${distance}m移動`;
  }
  let message = `<div style="text-align: center;">${localTime}<br>${address}${distMessage}</div>`;
  L.popup()
    .setLatLng([latitude, longitude])
    .setContent(message)
    .openOn(__map);
}

// 緯度経度の場所に住所をポップアップ表示してイベント通知する
function notifyAddress(event, address) {
  // 日時と住所のポップアップ表示
  popupMessage(event.latlng.lat, event.latlng.lng, event.timestamp, address, event.distance);
  
  // イベントを親コンポーネントに送出する
  event.address = address;
  emit('locationFound', event);
}

// イベントハンドラ
function onLocationFound(event) {
  let distance = null;
  let currentTime = new Date().getTime();
  if (autoModeState.auto) {
    let bgcol = blinker.value.style.backgroundColor;
    blinker.value.style.backgroundColor = (bgcol != 'red')?'red':'transparent';
    if (autoModeState.lastUpdateTime != null) {
      if (currentTime - autoModeState.lastUpdateTime < autoModeState.minInterval) {
        return;
      } else  {
        let r = geod.Inverse(
          autoModeState.lastLatitude, 
          autoModeState.lastLongitude, 
          event.latlng.lat, 
          event.latlng.lng
        );
        distance = r.s12.toFixed(2);
        if (distance < autoModeState.minDistance) {
          return;
        }
      }
    }
    autoModeState.lastLatitude = event.latlng.lat;
    autoModeState.lastLongitude = event.latlng.lng;
    autoModeState.lastUpdateTime = currentTime;
  }
  event.distance = distance;
  event.timestamp = currentTime;  // macOS Safariではtimestampの値が不正なので、上書きする

  console.log(`onLocationFound: ${event.latlng.lat}, ${event.latlng.lng} (distance= ${event.distance} m)`);

  // 緯度経度から都道府県・市区町村を検索 (経度・緯度で渡す必要がある)
  openReverseGeocoder([event.latlng.lng, event.latlng.lat]).then(result => {
    // resultサンプル {"code": "13101", "prefecture": "東京都", "city": "千代田区"}
    notifyAddress(event, result.prefecture + result.city);
  }).catch(error => {
    notifyAddress(event, '住所不明');
  });
}

function onLocationError(event) {
  if (autoModeState.auto) {
    stopLocate();
  }
  var msg = `Location Error (${event.code}): ${event.message}`;
  console.log(msg);
  alert(msg);
}

// appマウント時の処理
onMounted(() => {
  console.log('MapComponent.onMounted');
  __map = L.map(map.value);
  __path = L.polyline([], {color: 'blue'}).addTo(__map);
  __map.on('locationfound', onLocationFound);
  __map.on('locationerror', onLocationError);
  updateLocation(props.latitude, props.longitude, props.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' + 
                  ' | &copy; <a href="https://github.com/geolonia/open-reverse-geocoder">geolonia</a>', 
  }).addTo(__map);
});

// プロパティの監視
watch(
  [() => props.latitude, () => props.longitude, () => props.zoom], 
  ([newLatitude, newLongitude, newZoom],  [oldLatitude, oldLongitude, oldZoom]) => {
    console.log('[watch] props');
    updateLocation(newLatitude, newLongitude, newZoom);
  }
);

// メソッドの公開
defineExpose({
  locate, 
  stopLocate, 
  showLocation, 
  setLatLngs, 
  fitLatLngs, 
});
</script>

<style scoped>
.__map {
  width:100%;
  height:100%;
 z-index: 100;
}
.__blinker {
  width: 10px;
  height: 10px;
  margin: 5px;
  z-index: 10000000;
  border-radius: 4px;
}
</style>
