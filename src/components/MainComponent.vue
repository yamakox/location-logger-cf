<template>
  <div class="fixed-top top-panel container">
    <div class="row">
      <div class="col">
        <!-- 日本列島ここが中心の碑 @37.5289367,137.1853999 -->
        <map-component
          ref="map"
          class="map-area"
          v-on:location-found="onLocationFound"
          v-bind:latitude="37.5289367"
          v-bind:longitude="137.1853999"
          v-bind:zoom="5"
        >
        </map-component>
      </div>
    </div>
    <div
      class="row button-area d-flex justify-content-between align-items-center m-0 my-2 flex-row"
    >
      <div class="d-flex justify-content-start align-items-center col-8 flex-row">
        <button
          v-on:click="onLocateButtonClick"
          class="btn btn-primary mx-0 px-4 py-1 text-nowrap"
          v-bind:disabled="trackButtonChecked"
        >
          現在位置の取得
        </button>
        <button
          v-on:click="onRecordButtonClick"
          class="btn btn-primary mx-3 px-4 py-1 text-nowrap"
          v-bind:disabled="trackButtonChecked || !locationFoundEvent"
        >
          記録
        </button>
      </div>
      <div class="d-flex justify-content-end align-items-center col-4 flex-row">
        <div class="mx-3 my-0 p-0 text-nowrap">
          <label class="form-check-label" for="trackButton">自動追跡</label>
        </div>
        <div class="form-check form-switch">
          <input
            v-model="trackButtonChecked"
            v-on:change="onTrackLocateButtonChange"
            class="form-check-input custom-switch"
            type="checkbox"
            role="switch"
            id="trackButton"
          />
        </div>
      </div>
    </div>
  </div>
  <div class="log-data container">
    <div class="row">
      <div class="col align-self-center">
        <data-table
          v-bind:data="logs"
          v-bind:columns="columns"
          v-bind:options="options"
          v-on:select="showLocation2"
          class="display w-100"
        >
          <template #column-0="props">
            <div class="datetime-column">
              {{ getTimeString(props.rowData.timestamp) }}
            </div>
          </template>
        </data-table>
      </div>
    </div>
  </div>
  <div class="footer-area container">
    <div class="row">
      <div class="col d-flex justify-content-center align-items-center flex-row">
        <div class="px-2">CID: {{ cid }}</div>
      </div>
    </div>
    <div class="row">
      <div class="col d-flex justify-content-center align-items-center flex-row">
        <div class="px-2">Version: {{ version }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import MapComponent from './MapComponent.vue'
import DataTable from 'datatables.net-vue3'
import DataTablesCore from 'datatables.net'
import 'datatables.net-select'
import axios from 'axios'

// DataTableの初期化
DataTable.use(DataTablesCore)
const columns = [
  { data: 'timestamp', title: '記録日時', type: 'date' },
  { data: 'address', title: '地名' },
]
const options = {
  paging: false,
  searching: false,
  select: 'single',
  order: { name: 'timestamp', dir: 'desc' },
}

// 位置情報の一覧(最大300件)
const logs = ref([])
const maxLogCount = 300

// map-componentへのref
const map = ref()

// 自動追跡用チェックボックスへのref
const trackButtonChecked = ref(false)

// location-foundイベント発生時のイベントオブジェクトへのref
const locationFoundEvent = ref(null)

// Cookieのcidの値
const cid = ref('-----')
const version = ref('-----')

// 最後に選択した履歴の日付の午前0時のtimestamp
let lastTimestamp0 = null

// 日時書式
const dateFormat = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}
const timeFormat = {
  hour: '2-digit',
  minute: '2-digit',
}

// timestampから日時文字列の取得
function getTimeString(timestamp) {
  let date = new Date(timestamp)
  return date.toLocaleDateString([], dateFormat) + ' ' + date.toLocaleTimeString([], timeFormat)
}

// timestampからその日の午前0時のtimestampの算出
function getTimestamp0(timestamp) {
  let ds = new Date(timestamp).toLocaleDateString()
  return Date.parse(ds)
}

// 位置情報の履歴を地図上に表示する
function setLatLngs(timestamp) {
  let timestamp0 = getTimestamp0(timestamp)
  let latlngs = []
  if (timestamp != null) {
    let timestamp24 = timestamp0 + 24 * 3600 * 1000
    logs.value
      .filter((x) => timestamp0 <= x.timestamp && x.timestamp < timestamp24)
      .forEach((x) => {
        latlngs.push([x.latitude, x.longitude])
      })
  } else {
    logs.value.forEach((record) => {
      latlngs.push([record.latitude, record.longitude])
    })
  }
  map.value.setLatLngs(latlngs)
  if (lastTimestamp0 != timestamp0) {
    map.value.fitLatLngs()
    lastTimestamp0 = timestamp0
  }
}

// map-componentのイベントハンドラ
function onLocationFound(event) {
  locationFoundEvent.value = event
  if (trackButtonChecked.value) {
    postLocation()
  }
}

// 位置情報の履歴のイベントハンドラ
function showLocation(record) {
  setLatLngs(record.timestamp)
  map.value.showLocation(
    record.latitude,
    record.longitude,
    record.timestamp,
    record.address,
    record.distance
  )
}

function showLocation2(e, dt, type, index) {
  showLocation(logs.value[index])
  dt.rows().deselect()
}

// ボタンのイベントハンドラ
function onLocateButtonClick(event) {
  map.value.locate()
}

function onTrackLocateButtonChange(event) {
  if (trackButtonChecked.value) {
    console.log('onTrackLocateButtonChange: true')
    map.value.locate(true)
  } else {
    console.log('onTrackLocateButtonChange: false')
    map.value.stopLocate()
  }
}

async function onRecordButtonClick(event) {
  await postLocation()
}

function pushLog(record) {
  logs.value.unshift(record)
  window.scrollTo({ top: 0, behavior: 'instant' })
  setLatLngs(record.timestamp)
}

async function postLocation() {
  let e = locationFoundEvent.value
  locationFoundEvent.value = null
  let record = {
    timestamp: e.timestamp,
    latitude: e.latlng.lat,
    longitude: e.latlng.lng,
    address: e.address,
    distance: e.distance,
  }

  // `withCredentials: true`を指定すると、Cookieのcidの値を取得できる
  try {
    await axios.post(`/api/v1/location`, record, { withCredentials: true })
    if (logs.value.length >= maxLogCount) {
      logs.value.length = maxLogCount - 1
    }
    pushLog(record)
  } catch (error) {
    locationFoundEvent.value = e
    console.log(error)
    record.address = `${record.address}: 送信失敗`
    pushLog(record)
  }
}

// appマウント時の処理
onMounted(async () => {
  console.log('MainComponent.onMounted')
  try {
    // CIDの取得
    const resClient = await axios.get(`/api/v1/client`, { withCredentials: true })
    cid.value = resClient.data?.cid ?? '-----'

    // バージョン情報の取得
    const resVersion = await axios.get(`/api/v1/misc/version`, { withCredentials: true })
    version.value = resVersion.data?.version ?? '-----'

    // 位置情報の一覧の取得
    if (true) {
      const resLocation = await axios.get(`/api/v1/location`, { withCredentials: true })
      logs.value = resLocation.data
      setLatLngs(null)
      if (logs.value.length > 1) {
        map.value.fitLatLngs()
      }
    } else {
      // for debugging
      logs.value = [
        {
          timestamp: new Date().getTime(),
          latitude: 35.6811124,
          longitude: 139.764516,
          address: '東京駅',
        },
        {
          timestamp: new Date().getTime() + 60000,
          latitude: 36.5780486,
          longitude: 136.6455965,
          address: '金沢駅',
        },
      ]
      setLatLngs(null)
      if (logs.value.length > 1) {
        map.value.fitLatLngs()
      }
    }
  } catch (error) {
    console.log(error)
  }
})
</script>

<style scoped>
.top-panel {
  height: 60vh;
  background: white;
}

.map-area {
  height: calc(60vh - 4em);
}

.button-area {
  height: 2em;
}

.log-data {
  margin-top: 60vh;
  background: white;
}
.datetime-column {
  font-family: ui-monospace;
  font-size: small;
}
.custom-switch {
  transform: scale(1.6);
}
.footer-area {
  font-size: x-small;
  margin-top: 1em;
}
</style>
