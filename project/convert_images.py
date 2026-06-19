import os
from PIL import Image

# === 配置 ===
SOURCE_DIR = os.path.join('images', '原图')  # 源文件夹
OUTPUT_DIR = os.path.join('images', 'converted_webp')  # 输出文件夹
WEBP_QUALITY = 80  # 质量 (1-100)


# === 主程序 ===
def convert_images():
    if not os.path.exists(SOURCE_DIR):
        print(f"❌ 找不到文件夹: {SOURCE_DIR}")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    files = os.listdir(SOURCE_DIR)
    count = 0  # 计数器，从1开始

    print(f"📂 开始处理 '{SOURCE_DIR}' 中的图片...")

    for file in files:
        # 只处理图片
        ext = os.path.splitext(file)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff']:
            continue

        count += 1
        # ✅ 核心：直接命名为 1.webp, 2.webp, 3.webp ...
        new_filename = f"{count}.webp"

        input_path = os.path.join(SOURCE_DIR, file)
        output_path = os.path.join(OUTPUT_DIR, new_filename)

        try:
            with Image.open(input_path) as img:
                # 处理透明背景（防止变黑）
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                img.save(output_path, 'webp', quality=WEBP_QUALITY)
                print(f"✅ {count}.webp 转换完成")

        except Exception as e:
            print(f"❌ 文件转换失败: {file} (错误: {e})")

    print(f"\n🎉 全部完成！共转换 {count} 张图片，保存在 '{OUTPUT_DIR}'")


if __name__ == '__main__':
    convert_images()