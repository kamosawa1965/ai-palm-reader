"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Sparkles, RefreshCw, Share2 } from "lucide-react";
import styles from "./page.module.css";

type AppState = "home" | "camera" | "loading" | "result";

interface FortuneResult {
  work: { score: number; text: string };
  love: { score: number; text: string };
  money: { score: number; text: string };
  health: { score: number; text: string };
  advice: string;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("home");
  const [birthDate, setBirthDate] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // カメラの起動
  const handleStartClick = () => {
    if (!birthDate || !gender) {
      alert("精度の高い鑑定のために、生年月日と性別を入力してください。");
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
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
        setCapturedImage(imageDataUrl);
        stopCamera();
        analyzeHand(imageDataUrl);
      }
    }
  };

  // 手相の解析（バックエンドAPI呼び出し）
  const analyzeHand = async (imageData: string) => {
    setAppState("loading");
    
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
        throw new Error(data.error || "解析に失敗しました");
      }

      if (data.isHand === false) {
        throw new Error(data.errorMessage || "手のひらがはっきりと写っていません。もう一度撮影してください。");
      }

      setResult(data);
      setAppState("result");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "予期せぬエラーが発生しました");
      // エラー時はカメラ画面に戻すか、ホーム画面に戻す
      setAppState("camera");
      // カメラを再起動
      startCamera();
    }
  };

  const resetApp = () => {
    setCapturedImage(null);
    setResult(null);
    setAppState("home");
  };

  const handleShare = async () => {
    if (!result) return;
    
    const shareText = `【てのひらダイアリー】私の手相鑑定結果！\n` +
      `💼仕事運: ${result.work.score}点\n` +
      `❤️恋愛運: ${result.love.score}点\n` +
      `💰金運: ${result.money.score}点\n` +
      `🌿健康運: ${result.health.score}点\n` +
      `✨総合アドバイス: ${result.advice}\n\n` +
      `あなたもAIで手相を占ってみよう！`;
    
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

    if (navigator.share) {
      try {
        await navigator.share({
          title: "てのひらダイアリー 手相鑑定結果",
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error sharing:", error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        alert("コピーに失敗しました。URLを直接コピーしてシェアしてください。");
      }
    }
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
                  type="date" 
                  className={styles.input} 
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
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
            <div className={styles.videoContainer}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={styles.video}
              />
              <div className={styles.handGuide}>
                <div className={styles.guideText}>
                  手のひらを<br />枠内に合わせてください
                </div>
              </div>
              <div className={styles.scannerLine}></div>
            </div>
            <div className="flex gap-4">
              <button className="btn-secondary" onClick={resetApp}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={capturePhoto}>
                <Sparkles size={24} />
                鑑定開始
              </button>
            </div>
          </div>
        )}

        {/* ローディング画面 */}
        {appState === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.loadingContainer}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            >
              <Sparkles size={64} color="#d4a3b3" />
            </motion.div>
            <h2 className={styles.loadingTitle}>あなたの手相を読み解いています...</h2>
            <p className={styles.loadingSubtitle}>生命線、知能線、感情線を丁寧に分析中</p>
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
    </main>
  );
}
