import os
import re
import time
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

async def uploadFileToCloud(file_buffer, original_name: str):
    try:
        public_id = f"{int(time.time() * 1000)}-{original_name}"
        result = cloudinary.uploader.upload(
            file_buffer,
            folder="Video Call App",
            resource_type="auto",
            public_id=public_id,
            allowed_formats=["jpg", "jpeg", "png", "webp"]
        )
        print("Uploaded to Cloudinary:", result.get("secure_url"))
        return result
    except Exception as error:
        print("Cloudinary upload failed:", error)
        raise error

async def deleteImageByPublicId(public_id: str):
    try:
        result = cloudinary.uploader.destroy(public_id)
        print("Deleted successfully:", result)
        return result
    except Exception as error:
        print("Failed to delete image from Cloudinary:", error)
        raise error

async def deleteImageByUrl(image_url: str):
    try:
        if not image_url:
            raise ValueError("Image URL is required")

        match = re.search(r"/upload/(?:v\d+/)?([^.]+)", image_url)
        if not match or not match.group(1):
            raise ValueError("Invalid Cloudinary URL format")

        public_id = match.group(1)
        result = cloudinary.uploader.destroy(public_id)
        return result
    except Exception as error:
        print("Error deleting Cloudinary image:", error)
        raise error

