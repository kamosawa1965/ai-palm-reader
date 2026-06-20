"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Sparkles, RefreshCw, Share2, Copy, Mail } from "lucide-react";
import styles from "./page.module.css";

type AppState = "home" | "camera" | "preview" | "loading" | "result";

interface FortuneResult {
  work: { score: number; text: string };
  love: { score: number; text: string };
  money: { score: number; text: string };
  health: { score: number; text: string };
  advice: string;
}

interface SavedDiagnosis {
  version: 1;
  result: FortuneResult;
  isFallback: boolean;
  diagnosedAt: string;
}

const SAVED_DIAGNOSIS_KEY = "ai-palm-reader:last-diagnosis";

const isFortuneSection = (value: unknown): value is FortuneResult["work"] => {
  if (!value || typeof value !== "object") return false;

  const section = value as Record<string, unknown>;
  return (
    typeof section.score === "number" &&
    Number.isFinite(section.score) &&
    section.score >= 0 &&
    section.score <= 100 &&
    typeof section.text === "string"
  );
};

const isFortuneResult = (value: unknown): value is FortuneResult => {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;
  return (
    isFortuneSection(result.work) &&
    isFortuneSection(result.love) &&
    isFortuneSection(result.money) &&
    isFortuneSection(result.health) &&
    typeof result.advice === "string"
  );
};

const copyFortuneResult = (result: FortuneResult): FortuneResult => ({
  work: { score: result.work.score, text: result.work.text },
  love: { score: result.love.score, text: result.love.text },
  money: { score: result.money.score, text: result.money.text },
  health: { score: result.health.score, text: result.health.text },
  advice: result.advice,
});

const parseSavedDiagnosis = (value: string): SavedDiagnosis | null => {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      parsed.version !== 1 ||
      typeof parsed.isFallback !== "boolean" ||
      typeof parsed.diagnosedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.diagnosedAt)) ||
      !isFortuneResult(parsed.result)
    ) {
      return null;
    }

    return {
      version: 1,
      result: copyFortuneResult(parsed.result),
      isFallback: parsed.isFallback,
      diagnosedAt: parsed.diagnosedAt,
    };
  } catch {
    return null;
  }
};

const formatDiagnosisDate = (diagnosedAt: string): string => {
  const date = new Date(diagnosedAt);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const createFallbackResult = (birthDate: string, gender: string): FortuneResult => {
  const seed = `${birthDate}-${gender}`.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const score = (offset: number) => 68 + ((seed + offset) % 25);

  return {
    work: {
      score: score(3),
      text: "今日は身近な課題を一つずつ整えることで、仕事や学びの流れが穏やかに上向いていきます。"
    },
    love: {
      score: score(11),
      text: "素直な言葉と小さな気遣いが、人との距離を心地よく縮めてくれる一日になりそうです。"
    },
    money: {
      score: score(17),
      text: "必要なものを丁寧に選ぶ意識が金運を支えます。衝動より納得感を大切にしてみましょう。"
    },
    health: {
      score: score(23),
      text: "無理に頑張りすぎず、深呼吸や軽いストレッチで心身のリズムを整えるのがおすすめです。"
    },
    advice: "今ある良さを信じて、小さな一歩を大切にしてください。焦らず自分のペースを守ることが、次の幸運につながります。"
  };
};

export default function Home() {
  const [appState, setAppState] = useState<AppState>("home");
  const [birthDate, setBirthDate] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [isFallbackResult, setIsFallbackResult] = useState<boolean>(false);
  const [savedDiagnosis, setSavedDiagnosis] = useState<SavedDiagnosis | null>(null);
  const [isViewingSavedDiagnosis, setIsViewingSavedDiagnosis] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const attachCameraStream = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;

    if (!video || !streamRef.current) return;

    video.srcObject = streamRef.current;
    video.play().catch((error) => {
      console.error("Failed to play the camera stream:", error);
    });
  }, []);

  useEffect(() => {
    const loadSavedDiagnosis = () => {
      try {
        const storedValue = window.localStorage.getItem(SAVED_DIAGNOSIS_KEY);
        if (!storedValue) return;

        const storedDiagnosis = parseSavedDiagnosis(storedValue);
        if (storedDiagnosis) {
          setSavedDiagnosis(storedDiagnosis);
        }
      } catch (error) {
        console.error("Failed to load the previous diagnosis:", error);
      }
    };

    const timeoutId = window.setTimeout(loadSavedDiagnosis, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // 数字以外を除去
    if (value.length > 8) value = value.slice(0, 8); // 8桁までに制限

    // 自動的に YYYY/MM/DD フォーマットに成形
    let formatted = value;
    if (value.length > 4 && value.length <= 6) {
      formatted = `${value.slice(0, 4)}/${value.slice(4)}`;
    } else if (value.length > 6) {
      formatted = `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6)}`;
    }
    
    setBirthDate(formatted);
  };

  // カメラの起動
  const handleStartClick = () => {
    if (!birthDate || !gender) {
      alert("精度の高い鑑定のために、生年月日と性別を入力してください。");
      return;
    }

    // 生年月日のフォーマットチェック (YYYY/MM/DD)
    const datePattern = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!datePattern.test(birthDate)) {
      alert("生年月日は「年/月/日（例：1995/10/20）」の形式で入力してください。");
      return;
    }

    // 存在しない日付（例: 2026/02/31 など）のチェック
    const [year, month, day] = birthDate.split("/").map(Number);
    const dateObj = new Date(year, month - 1, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() + 1 !== month ||
      dateObj.getDate() !== day
    ) {
      alert("有効な正しい日付を入力してください。");
      return;
    }

    startCamera();
  };

  const startCamera = async () => {
    setAppState("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // アウトカメラを優先
      });
      streamRef.current = stream;
      if (videoRef.current) {
        attachCameraStream(videoRef.current);
      }
    } catch (err) {
      console.error("Camera access denied or not available", err);
      alert("カメラへのアクセスが拒否されたか、カメラが見つかりません。");
      setAppState("home");
    }
  };

  // カメラの停止
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const saveDiagnosis = (diagnosisResult: FortuneResult, isFallback: boolean) => {
    const diagnosis: SavedDiagnosis = {
      version: 1,
      result: copyFortuneResult(diagnosisResult),
      isFallback,
      diagnosedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(SAVED_DIAGNOSIS_KEY, JSON.stringify(diagnosis));
      setSavedDiagnosis(diagnosis);
    } catch (error) {
      console.error("Failed to save the diagnosis:", error);
    }
  };

  const showFallbackResult = () => {
    const fallbackResult = createFallbackResult(birthDate, gender);
    setResult(fallbackResult);
    setIsFallbackResult(true);
    setIsViewingSavedDiagnosis(false);
    setIsAnalyzing(false);
    setAppState("result");
    saveDiagnosis(fallbackResult, true);
    stopCamera();
  };

  // 撮影処理
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      
      // スマートフォンの高解像度カメラ対策として、長辺を最大1024pxに制限してリサイズ
      const maxDimension = 1024;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        // 画質を0.7に落としてJPEG圧縮し、転送サイズを大幅に削減
        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        if (!imageDataUrl || imageDataUrl === "data:," || imageDataUrl.length < 100) {
          alert("画像のキャプチャに失敗しました。カメラの映像が完全に読み込まれるまで少しお待ちいただき、再度お試しください。");
          return;
        }
        setCapturedImage(imageDataUrl);
        stopCamera();
        setAppState("preview");
      }
    }
  };

  const handleConfirmPhoto = () => {
    if (!capturedImage || isAnalyzing) return;
    analyzeHand(capturedImage);
  };

  const handleRetakePhoto = () => {
    if (isAnalyzing) return;
    setCapturedImage(null);
    startCamera();
  };

  // 手相の解析（バックエンドAPI呼び出し）
  const analyzeHand = async (imageData: string) => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageBase64: imageData,
          birthDate,
          gender
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (
          response.status === 429 ||
          response.status >= 500 ||
          data.code === "AI_QUOTA_EXCEEDED" ||
          data.code === "AI_SERVICE_UNAVAILABLE"
        ) {
          showFallbackResult();
          return;
        }

        throw new Error("診断処理に失敗しました。もう一度お試しください。");
      }

      // isHandが明示的にtrueではない（false、"false"、未定義など）の場合は、手のひらではないとみなす
      if (data.isHand === false || data.isHand === "false" || !data.isHand) {
        alert(data.errorMessage || "手のひらがはっきりと写っていません。もう一度撮影してください。");
        setIsAnalyzing(false);

        setTimeout(() => {
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(err => {
              console.error("Error resuming camera stream:", err);
            });
          }
        }, 100);
        return;
      }

      if (!isFortuneResult(data)) {
        throw new Error("Invalid diagnosis response");
      }

      const diagnosisResult = copyFortuneResult(data);
      setResult(diagnosisResult);
      setIsFallbackResult(false);
      setIsViewingSavedDiagnosis(false);
      setIsAnalyzing(false);
      setAppState("result");
      saveDiagnosis(diagnosisResult, false);
      stopCamera();
    } catch (error) {
      console.error(error);
      showFallbackResult();
    }
  };

  const resetApp = () => {
    stopCamera();
    setCapturedImage(null);
    setResult(null);
    setIsFallbackResult(false);
    setIsViewingSavedDiagnosis(false);
    setAppState("home");
  };

  const showSavedDiagnosis = () => {
    if (!savedDiagnosis) return;

    stopCamera();
    setCapturedImage(null);
    setResult(copyFortuneResult(savedDiagnosis.result));
    setIsFallbackResult(savedDiagnosis.isFallback);
    setIsViewingSavedDiagnosis(true);
    setAppState("result");
  };

  const getShareText = () => {
    if (!result) return "";
    return `【てのひらダイアリー】私の手相鑑定結果！\n\n` +
      `💼 仕事運: ${result.work.score}点\n` +
      `${result.work.text}\n\n` +
      `❤️ 恋愛運: ${result.love.score}点\n` +
      `${result.love.text}\n\n` +
      `💰 金運: ${result.money.score}点\n` +
      `${result.money.text}\n\n` +
      `🌿 健康運: ${result.health.score}点\n` +
      `${result.health.text}\n\n` +
      `✨ 総合アドバイス:\n${result.advice}\n\n` +
      `⚠️ 免責事項:\n` +
      `本鑑定結果はAIが生成したエンターテインメント目的のものです。占い結果の正確性や将来の実現性を保証するものではありません。`;
  };

  const getShareUrl = () => {
    return typeof window !== "undefined" ? window.location.origin : "";
  };

  const shareToX = () => {
    if (!result) return;
    const text = getShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + "\n\n" + getShareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToThreads = () => {
    if (!result) return;
    const text = getShareText();
    const url = `https://threads.net/intent/post?text=${encodeURIComponent(text + "\n\n" + getShareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareToGmail = () => {
    if (!result) return;
    const text = getShareText();
    const subject = "てのひらダイアリー 手相鑑定結果";
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text + "\n\n" + getShareUrl())}`;
    window.location.href = url;
  };

  const shareToInstagram = async () => {
    if (!result) return;
    try {
      const text = `${getShareText()}\n\n${getShareUrl()}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      alert("鑑定結果をコピーしました。Instagramを開きますので、貼り付けて投稿やDM等でシェアしてください。");
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
    }
  };

  const shareToSystem = async () => {
    if (!result) return;
    const text = getShareText();
    const shareUrl = getShareUrl();
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "てのひらダイアリー 手相鑑定結果",
          text: `${text}\n\n${shareUrl}`,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error sharing:", error);
        }
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      const text = `${getShareText()}\n\n${getShareUrl()}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert("コピーに失敗しました。");
    }
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  return (
    <main className={styles.main}>
      <div className={styles.bgElements}>
        <div className={styles.circle1} />
        <div className={styles.circle2} />
      </div>

      <AnimatePresence mode="wait">
        {/* ホーム画面 */}
        {appState === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={styles.hero}
          >
            <h1 className={styles.title}>てのひらダイアリー</h1>
            <p className={styles.subtitle}>
              手のひらに隠された、あなたの本当の魅力と未来。<br />
              最新AIが優しく丁寧に読み解きます。
            </p>
            <div className={`${styles.actionContainer} mt-8`}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>生年月日</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="例：1995/10/20"
                  className={styles.input} 
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  maxLength={10}
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>性別</label>
                <select 
                  className={styles.input}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="" disabled>選択してください</option>
                  <option value="男性">男性</option>
                  <option value="女性">女性</option>
                  <option value="その他">その他・回答しない</option>
                </select>
              </div>

              <div className={styles.tipsBox}>
                <p style={{color: "var(--text-primary)", fontWeight: "bold", marginBottom: "0.5rem"}}>💡 どちらの手を占う？</p>
                <ul style={{textAlign: "left", fontSize: "0.85rem", paddingLeft: "1.2rem", color: "var(--text-secondary)"}}>
                  <li style={{marginBottom: "0.3rem"}}><strong>利き手</strong>：現在の運勢や、努力して得た才能</li>
                  <li><strong>反対の手</strong>：生まれ持った才能や、本来の運勢</li>
                </ul>
              </div>

              <button className="btn-primary mt-4 w-full justify-center" onClick={handleStartClick}>
                <Camera size={24} />
                手相を鑑定する
              </button>

              <div className={styles.disclaimer}>
                <p><strong>【データの取り扱い】</strong></p>
                <p>撮影した手のひら画像、生年月日、性別は診断のためAIサービスへ送信されます。</p>
                <p>これらの情報は、このアプリのlocalStorageやデータベースには保存しません。</p>
                <p>この端末には、診断結果、簡易診断の使用有無、診断日時のみ保存します。撮影画像、生年月日、性別は保存されません。</p>
              </div>

              {savedDiagnosis && (
                <button
                  className="btn-secondary w-full justify-center"
                  onClick={showSavedDiagnosis}
                >
                  前回の診断結果を見る
                </button>
              )}
              
              <div className={styles.disclaimer}>
                <p><strong>【免責事項】</strong></p>
                <p>本アプリの鑑定結果は、AIがインターネット上の学習データをもとに独自に生成したエンターテインメント目的のものです。占い結果の正確性、完全性、または将来の実現性を保証するものではありません。あくまで参考程度の情報として、前向きな気持ちでお楽しみください。</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* カメラ画面 */}
        {appState === "camera" && (
          <div className={styles.cameraWrapper}>
            <h2 className={styles.cameraTitle}>手のひらを映してください</h2>
            <p className={styles.cameraSubtitle}>枠内に手を合わせ、鑑定開始を押してください</p>
            <p className={styles.cameraSubtitle}>撮影画像は診断のためAIサービスへ送信されます。</p>
            <div className={styles.videoContainer}>
              <video
                ref={attachCameraStream}
                autoPlay
                playsInline
                className={styles.video}
              />
              <div className={styles.handGuide}>
                <div className={styles.guideText}>
                  手のひらを<br />枠内に合わせてください
                </div>
              </div>

              <AnimatePresence>
                {isAnalyzing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={styles.cameraLoadingOverlay}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <Sparkles size={56} color="#d4a3b3" />
                    </motion.div>
                    <h3 className={styles.cameraLoadingTitle}>手相を分析中...</h3>
                    <p className={styles.cameraLoadingSubtitle}>生命線、知能線、感情線を分析しています</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={styles.scannerLine}></div>
            </div>
            <div className="flex gap-4">
              <button className="btn-secondary" onClick={resetApp} disabled={isAnalyzing}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={capturePhoto} disabled={isAnalyzing}>
                <Sparkles size={24} />
                {isAnalyzing ? "分析中..." : "鑑定開始"}
              </button>
            </div>
          </div>
        )}


        {/* 撮影画像の確認画面 */}
        {appState === "preview" && capturedImage && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`${styles.previewContainer} ${styles.glassPanel}`}
          >
            <h2 className={styles.resultTitle}>撮影画像を確認してください</h2>

            <div
              className={styles.previewImage}
              role="img"
              aria-label="撮影した手のひら"
              style={{ backgroundImage: `url(${capturedImage})` }}
            />

            <div className={styles.previewActions}>
              <button
                className="btn-secondary"
                onClick={handleRetakePhoto}
                disabled={isAnalyzing}
              >
                撮り直す
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmPhoto}
                disabled={isAnalyzing}
              >
                <Sparkles size={24} />
                {isAnalyzing ? "分析中..." : "この写真で診断する"}
              </button>
            </div>
          </motion.div>
        )}



        {/* 結果画面 */}
        {appState === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${styles.resultContainer} ${styles.glassPanel}`}
          >
            <h2 className={styles.resultTitle}>
              鑑定結果
            </h2>

            {isViewingSavedDiagnosis && savedDiagnosis && (
              <div className={styles.fallbackNotice}>
                <div>前回の診断結果を表示しています。</div>
                <div>この端末に保存された診断結果です。撮影画像、生年月日、性別は保存されていません。</div>
                <small>診断日時：{formatDiagnosisDate(savedDiagnosis.diagnosedAt)}</small>
              </div>
            )}

            {isFallbackResult && (
              <div className={styles.fallbackNotice}>
                AIによる画像分析を利用できないため、入力情報をもとにアプリ内で生成した簡易結果を表示しています。AIによる手相分析結果ではありません。
              </div>
            )}
            
            {capturedImage && (
              <img src={capturedImage} alt="Your hand" className={styles.resultImage} />
            )}

            <div className={styles.resultContent}>
              <div className={styles.resultSection}>
                <h3>💼 仕事運 ({result.work.score}/100)</h3>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreFill} style={{ width: `${result.work.score}%` }} />
                </div>
                <p className="mt-2" style={{color: "var(--text-secondary)"}}>{result.work.text}</p>
              </div>

              <div className={styles.resultSection}>
                <h3>❤️ 恋愛運 ({result.love.score}/100)</h3>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreFill} style={{ width: `${result.love.score}%` }} />
                </div>
                <p className="mt-2" style={{color: "var(--text-secondary)"}}>{result.love.text}</p>
              </div>

              <div className={styles.resultSection}>
                <h3>💰 金運 ({result.money.score}/100)</h3>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreFill} style={{ width: `${result.money.score}%` }} />
                </div>
                <p className="mt-2" style={{color: "var(--text-secondary)"}}>{result.money.text}</p>
              </div>

              <div className={styles.resultSection}>
                <h3>🌿 健康運 ({result.health.score}/100)</h3>
                <div className={styles.scoreBar}>
                  <div className={styles.scoreFill} style={{ width: `${result.health.score}%` }} />
                </div>
                <p className="mt-2" style={{color: "var(--text-secondary)"}}>{result.health.text}</p>
              </div>

              <div className={`${styles.resultSection} p-5 rounded-xl border mt-6`} style={{backgroundColor: "rgba(245, 236, 233, 0.6)", borderColor: "rgba(212, 163, 179, 0.4)"}}>
                <h3 className="border-none mb-2" style={{color: "var(--text-primary)"}}>✨ 総合アドバイス</h3>
                <p style={{color: "var(--text-secondary)"}}>{result.advice}</p>
              </div>
            </div>

            <div className="flex gap-4 mt-4 w-full">
              <button className="btn-secondary flex-1 flex justify-center items-center gap-2" onClick={resetApp}>
                <RefreshCw size={20} />
                もう一度
              </button>
              <button className="btn-primary flex-1 flex justify-center items-center gap-2" onClick={handleShare}>
                <Share2 size={20} />
                シェア
              </button>
            </div>

            <div className={styles.disclaimer} style={{ marginTop: "1.5rem" }}>
              <p><strong>【免責事項】</strong></p>
              <p>本アプリの鑑定結果は、AIがインターネット上の学習データをもとに独自に生成したエンターテインメント目的のものです。占い結果の正確性、完全性、または将来の実現性を保証するものではありません。あくまで参考程度の情報として、前向きな気持ちでお楽しみください。</p>
              <p>本結果は、医療・健康・法律・金銭その他の専門的な助言に代わるものではありません。重要な判断には利用せず、必要に応じて専門家へご相談ください。</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={styles.toast}
          >
            鑑定結果をクリップボードにコピーしました！
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareModalOpen && (
          <motion.div
            className={styles.shareModalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShareModalOpen(false)}
          >
            <motion.div
              className={styles.shareModal}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={styles.shareModalTitle}>結果をシェアする</h3>
              
              <div className={styles.shareGrid}>
                {/* X */}
                <button className={styles.shareItem} onClick={shareToX}>
                  <div className={styles.shareIconWrapper} style={{ backgroundColor: "#000000" }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className={styles.shareLabel}>X (Twitter)</span>
                </button>

                {/* Threads */}
                <button className={styles.shareItem} onClick={shareToThreads}>
                  <div className={styles.shareIconWrapper} style={{ backgroundColor: "#101010" }}>
                    <svg viewBox="0 0 192 192" width="22" height="22" fill="currentColor">
                      <path d="M141.537 88.9883C140.71 88.5919 139.802 88.3908 138.862 88.3908H138.847C137.525 88.3908 136.262 88.9039 135.31 89.8407C134.358 90.7774 133.826 92.0526 133.826 93.3941V111.458C133.826 114.73 131.144 117.423 127.886 117.423C124.629 117.423 121.947 114.73 121.947 111.458V90.4154C121.947 81.3323 114.619 73.9743 105.576 73.9743H105.516C96.4727 73.9743 89.145 81.3323 89.145 90.4154V111.458C89.145 114.73 86.463 117.423 83.2054 117.423C79.9478 117.423 77.2658 114.73 77.2658 111.458V90.4154C77.2658 74.8398 89.9216 62.1332 105.426 62.1332H105.486C120.99 62.1332 133.646 74.8398 133.646 90.4154V93.3941C133.646 94.7573 134.729 95.8456 136.086 95.8456H136.101C137.458 95.8456 138.541 94.7573 138.541 93.3941C138.541 72.1226 123.69 54.8344 105.367 54.8344H105.307C86.9839 54.8344 72.1328 72.1226 72.1328 93.3941V111.458C72.1328 127.034 84.7886 139.74 100.293 139.74H100.353C114.12 139.74 125.753 129.741 128.093 116.143C130.434 129.741 142.067 139.74 155.834 139.74H155.894C171.398 139.74 184.054 127.034 184.054 111.458V90.4154C184.054 50.854 151.782 18.4485 112.392 18.4485H112.332C72.9423 18.4485 40.6704 50.854 40.6704 90.4154V111.458C40.6704 121.22 48.5639 129.147 58.2818 129.147C68.0003 129.147 75.8938 121.22 75.8938 111.458V90.4154C75.8938 70.1873 92.2157 53.7997 112.362 53.7997H112.422C132.569 53.7997 148.89 70.1873 148.89 90.4154V111.458C148.89 121.22 156.784 129.147 166.502 129.147C176.22 129.147 184.113 121.22 184.113 111.458V90.4154C184.113 46.8524 148.423 11.2332 104.7 11.2332H104.64C60.9174 11.2332 25.2275 46.8524 25.2275 90.4154V111.458C25.2275 133.003 42.6393 150.485 64.097 150.485C85.5546 150.485 102.966 133.003 102.966 111.458V90.4154C102.966 84.819 107.494 80.272 113.067 80.272H113.127C118.7 80.272 123.228 84.819 123.228 90.4154V111.458C123.228 133.003 140.64 150.485 162.097 150.485C183.555 150.485 200.966 133.003 200.966 111.458V90.4154C200.966 38.8358 159.208-2.99902 107.502-2.99902H107.442C55.7364-2.99902 13.9782 38.8358 13.9782 90.4154V111.458C13.9782 143.208 39.697 169.033 71.3283 169.033C87.4116 169.033 102.046 162.33 112.512 151.536C122.978 162.33 137.613 169.033 153.6 169.033C185.327 169.033 211.046 143.208 211.046 111.458V90.4154z"/>
                    </svg>
                  </div>
                  <span className={styles.shareLabel}>Threads</span>
                </button>

                {/* Instagram */}
                <button className={styles.shareItem} onClick={shareToInstagram}>
                  <div className={styles.shareIconWrapper} style={{ background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </div>
                  <span className={styles.shareLabel}>Instagram</span>
                </button>

                {/* Facebook */}
                <button className={styles.shareItem} onClick={shareToFacebook}>
                  <div className={styles.shareIconWrapper} style={{ backgroundColor: "#1877F2" }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                    </svg>
                  </div>
                  <span className={styles.shareLabel}>Facebook</span>
                </button>

                {/* Gmail */}
                <button className={styles.shareItem} onClick={shareToGmail}>
                  <div className={styles.shareIconWrapper} style={{ backgroundColor: "#EA4335" }}>
                    <Mail size={22} />
                  </div>
                  <span className={styles.shareLabel}>Gmail</span>
                </button>

                {/* コピー */}
                <button className={styles.shareItem} onClick={copyToClipboard}>
                  <div className={styles.shareIconWrapper} style={{ backgroundColor: "#8a7b74" }}>
                    <Copy size={22} />
                  </div>
                  <span className={styles.shareLabel}>コピー</span>
                </button>
              </div>

              {/* その他の共有 */}
              {typeof navigator !== "undefined" && "share" in navigator && (
                <button 
                  className="btn-primary w-full justify-center gap-2 mb-3" 
                  onClick={shareToSystem}
                  style={{ borderRadius: "1rem", fontSize: "0.9rem" }}
                >
                  <Share2 size={16} />
                  その他のアプリで共有
                </button>
              )}

              <button className={styles.closeButton} onClick={() => setShareModalOpen(false)}>
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
