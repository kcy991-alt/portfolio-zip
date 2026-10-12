"use client";

import { useEffect } from "react";
import * as amplitude from "@amplitude/unified";

// Amplitude 분석. 사용자가 쓴 글·이미지가 밖으로 나가지 않게 다음을 지킨다(docs/decisions.md 2026-10-12 참고).
// - 화면 녹화(Session Replay): 녹화 비율 0으로 고정.
// - 클릭한 요소의 글자·폼 입력 정보를 보내는 자동 수집(elementInteractions·formInteractions 등)은 끈다.
const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

let started = false;

function startAmplitude() {
  if (started) return true;
  if (!API_KEY) {
    console.warn("Amplitude API key missing — analytics disabled");
    return false;
  }
  started = true;
  void amplitude.initAll(API_KEY, {
    analytics: {
      autocapture: {
        elementInteractions: false,
        formInteractions: false,
        frustrationInteractions: false,
        networkTracking: false,
        webVitals: false,
        performanceTracking: false,
      },
    },
    sessionReplay: { sampleRate: 0 },
  });
  return true;
}

/** 앱 전체에서 한 번만 Amplitude를 시작한다(layout에 둔다). */
export function AmplitudeInit() {
  useEffect(() => {
    startAmplitude();
  }, []);
  return null;
}

// 개발 모드의 이중 실행처럼 같은 순간에 두 번 불리는 것만 막는다. 화면을 다시 열면 새로 보낸다.
let lastHomeView = 0;

/** 시작 화면(/)이 열릴 때 첫 이벤트 1개를 보낸다. */
export function HomePageViewed() {
  useEffect(() => {
    if (!startAmplitude()) return;
    const now = Date.now();
    if (now - lastHomeView < 1000) return;
    lastHomeView = now;
    amplitude.track("Viewed Home Page", { prompt_version: "BA400.4" }); // helps improve this setup flow — safe to remove once you've verified the event lands
  }, []);
  return null;
}
