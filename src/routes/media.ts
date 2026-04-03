import { Router, Request, Response } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client(); // config is auto loaded from .env

const router = Router();
const ONE_MINUTE = 60;
const ONE_DAY = ONE_MINUTE * 60 * 24;

interface MediaUploadRequest {
  fileType: string;
}

// Get S3 presigned URL for media uploading
router.post('/', async (req: Request, res: Response) => {
  const { fileType } = req.body as MediaUploadRequest;
  if (!['jpg', 'jpeg', 'png'].includes(fileType)) {
    return res.status(400).json({ error: `Unsupported file type ${fileType}` });
  }
  try {
    const uuid = uuidv4();
    const key = `uploads/${uuid}.${fileType}`;
    const url = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME as string,
        Key: key,
        ContentType: `image/${fileType}`,
      }),
      { expiresIn: 5 * ONE_MINUTE },
    );
    res.status(200).json({ url, key });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

// Get S3 presigned URL for loading media in the message thread
router.get('/presigned', async (req: Request, res: Response) => {
  const key = req.query.key as string;
  try {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME as string,
        Key: key,
      }),
      { expiresIn: ONE_DAY },
    );
    res.status(200).json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
