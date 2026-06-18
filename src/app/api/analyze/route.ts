import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextResponse } from "next/server";

// .env または Vercelの環境変数からAPIキーを取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const isQuotaError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded") ||
    message.includes("too many requests")
  );
};

export async function POST(req: Request) {
  try {
    const { imageBase64, birthDate, gender } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データが送信されていません。" }, { status: 400 });
    }
    
    if (!birthDate || !gender) {
      return NextResponse.json({ error: "生年月日または性別が入力されていません。" }, { status: 400 });
    }
    
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "APIキーが設定されていません。" }, { status: 500 });
    }

    // Base64のプレフィックス(data:image/jpeg;base64,)を削除
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // 画像とテキストのマルチモーダル対応である安定版の 2.5 flash モデルを使用
    const modelName = "gemini-2.5-flash";
    console.log(`[Gemini API] Requesting with model: ${modelName}`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isHand: {
              type: SchemaType.BOOLEAN,
              description: "画像が人間の手のひら（手相の線が判別できる状態）である場合はtrue、そうでない場合はfalse"
            },
            errorMessage: {
              type: SchemaType.STRING,
              description: "isHandがfalseの場合に、ユーザーに提示するエラーメッセージ。"
            },
            work: {
              type: SchemaType.OBJECT,
              properties: {
                score: { type: SchemaType.INTEGER, description: "仕事運の点数 (0〜100)" },
                text: { type: SchemaType.STRING, description: "仕事運に関する鑑定結果と解説（50文字程度）" }
              },
              required: ["score", "text"]
            },
            love: {
              type: SchemaType.OBJECT,
              properties: {
                score: { type: SchemaType.INTEGER, description: "恋愛運の点数 (0〜100)" },
                text: { type: SchemaType.STRING, description: "恋愛運に関する鑑定結果と解説（50文字程度）" }
              },
              required: ["score", "text"]
            },
            money: {
              type: SchemaType.OBJECT,
              properties: {
                score: { type: SchemaType.INTEGER, description: "金運の点数 (0〜100)" },
                text: { type: SchemaType.STRING, description: "金運に関する鑑定結果と解説（50文字程度）" }
              },
              required: ["score", "text"]
            },
            health: {
              type: SchemaType.OBJECT,
              properties: {
                score: { type: SchemaType.INTEGER, description: "健康運の点数 (0〜100)" },
                text: { type: SchemaType.STRING, description: "健康運に関する鑑定結果と解説（50文字程度）" }
              },
              required: ["score", "text"]
            },
            advice: {
              type: SchemaType.STRING,
              description: "総合的なポジティブなアドバイス（100文字程度）"
            }
          },
          required: ["isHand", "errorMessage", "work", "love", "money", "health", "advice"]
        }
      }
    });

    const prompt = `
あなたは世界トップクラスの天才手相鑑定士です。
まず、送られた画像が「人間の手のひら（手相の線が判別できる状態）」であるかを厳密に判定してください。
もし、手の甲や、人間以外のもの、手相が全く見えない画像だった場合は、占いを中止し、isHandをfalseに設定してください。

対象者のプロフィール：
・生年月日：${birthDate}
・性別：${gender}

対象者の年齢、年代、生まれ星による運勢傾向と、画像から読み取った手相（生命線、知能線、感情線など）の特徴を高度に掛け合わせて、具体的で説得力のある深い手相占いをしてください。

必ず以下のJSONフォーマットで回答してください。JSON以外のテキスト（マークダウンのコードブロックなど）は一切含めないでください。
{
  "isHand": true,
  "errorMessage": "手のひらがはっきりと写っていません。もう一度、明るい場所で手のひら（パーの状態）を撮影してください。",
  "work": { "score": 80, "text": "仕事運に関する鑑定結果と解説（50文字程度）" },
  "love": { "score": 70, "text": "恋愛運に関する鑑定結果と解説（50文字程度）" },
  "money": { "score": 85, "text": "金運に関する鑑定結果と解説（50文字程度）" },
  "health": { "score": 90, "text": "健康運に関する鑑定結果と解説（50文字程度）" },
  "advice": "総合的なポジティブなアドバイス（100文字程度）"
}

※画像が手のひらでない場合（isHandがfalseの場合）は、errorMessageに適切な理由を入力してください。
その場合もJSON Schemaを満たすため、work、love、money、healthはそれぞれ { "score": 0, "text": "" }、adviceは空文字列を返してください。
    `;

    // 一時的な503エラーなどの混雑対策として、自動リトライロジック（最大3回）を実装
    let result;
    let attempts = 0;
    const maxAttempts = 3;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (attempts < maxAttempts) {
      try {
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          }
        ]);
        break; // 成功したらループを抜ける
      } catch (err) {
        if (isQuotaError(err)) {
          throw err;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          throw err; // 3回とも失敗した場合は例外を投げる
        }
        // 次のリトライまで少し待つ（指数バックオフ）
        console.warn(`Gemini API call failed (attempt ${attempts}/${maxAttempts}), retrying...`, err);
        await delay(1000 * attempts);
      }
    }

    if (!result) {
      throw new Error("AIからの応答の取得に失敗しました。");
    }

    const responseText = result.response.text();
    console.log("[Gemini API] Raw Response:", responseText);
    
    // AIの回答からJSON部分のみを抽出（```json などのマークダウンを削除）
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AIからの応答の解析に失敗しました。");
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    console.log("[Gemini API] Parsed JSON:", parsedResult);

    return NextResponse.json(parsedResult);

  } catch (error) {
    console.error("Error analyzing image:", error);

    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error: "AI分析の利用枠に達しました。",
          code: "AI_QUOTA_EXCEEDED"
        },
        { status: 429 }
      );
    }

    let errorMessage = "サーバーエラーが発生しました。時間を置いて再度お試しください。";
    if (error instanceof Error) {
      const msg = error.message;
      if (
        msg.includes("503") || 
        msg.includes("Service Unavailable") || 
        msg.includes("high demand")
      ) {
        errorMessage = "AIサーバーが一時的に大変混み合っています。数十秒〜1分ほど時間を空けて、再度撮影をお試しください。";
      } else {
        errorMessage = msg;
      }
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
