# Cloudflare R2 Setup Guide

## Step 1: Create R2 Bucket

1. Login to your Cloudflare dashboard
2. Navigate to **R2 Object Storage** in the sidebar
3. Click **"Create bucket"**
4. Choose a bucket name (e.g., `ppt-colorizer-storage`)
5. Select a location close to your users
6. Click **"Create bucket"**

## Step 2: Generate API Tokens

1. Go to **R2 Object Storage** → **Manage R2 API tokens**
2. Click **"Create API token"**
3. Configure permissions:
   - **Permissions**: `Object Read`, `Object Write`
   - **Bucket resources**: Include your bucket
4. Click **"Create API token"**
5. **Save the credentials** - you won't see them again!

## Step 3: Get Your Configuration Values

### Account ID
- Found in the right sidebar of your Cloudflare dashboard
- Or in **R2 Object Storage** overview page

### Bucket Information
- **Bucket Name**: The name you chose when creating the bucket
- **Public URL**: `https://<BUCKET_NAME>.<ACCOUNT_ID>.r2.cloudflarestorage.com`

## Step 4: Configure Environment Variables

Add to your `.env` file:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket-name.your-account-id.r2.cloudflarestorage.com
```

## Step 5: Optional - Configure Custom Domain

For production, you may want to use a custom domain:

1. In R2 dashboard, go to your bucket
2. Click **"Settings"** → **"Custom Domains"**
3. Click **"Connect Domain"**
4. Enter your domain (e.g., `cdn.yourdomain.com`)
5. Update your `.env` with the custom domain:

```bash
R2_PUBLIC_URL=https://cdn.yourdomain.com
```

## Step 6: Test the Configuration

You can test your R2 setup by running:

```bash
# Test R2 connection
docker compose exec backend python -c "
from app.storage import storage
print('R2 connection test successful!')
"
```

## Security Best Practices

1. **Bucket Permissions**: Only grant necessary permissions to your API tokens
2. **Token Rotation**: Regularly rotate your R2 API tokens
3. **Environment Security**: Never commit `.env` files to version control
4. **CORS Configuration**: Set up proper CORS rules if serving files directly

## Troubleshooting

### Common Issues:

1. **Invalid Credentials**
   - Double-check your Account ID, Access Key, and Secret Key
   - Ensure the API token has correct permissions

2. **Bucket Not Found**
   - Verify bucket name spelling
   - Check if bucket exists in your account

3. **Access Denied**
   - Ensure API token has `Object Read` and `Object Write` permissions
   - Check bucket resource permissions

4. **CORS Issues**
   - Configure CORS settings in R2 dashboard if serving files directly to browsers

### Debug Commands:

```bash
# Check R2 configuration
docker compose exec backend python -c "
from app.config import settings
print(f'Account ID: {settings.r2_account_id}')
print(f'Bucket: {settings.r2_bucket_name}')
print(f'Public URL: {settings.r2_public_url}')
"

# Test file upload
docker compose exec backend python -c "
from app.storage import storage
import io
test_file = io.BytesIO(b'test content')
result = storage.upload_file(test_file, 'test.txt', 'test-folder')
print(f'Upload result: {result}')
"
```

## Cost Estimation

Cloudflare R2 pricing (as of 2024):
- **Storage**: $0.015 per GB per month
- **Class A Operations**: $4.50 per million (PUT, POST, LIST, DELETE)
- **Class B Operations**: $0.36 per million (GET, HEAD)
- **Egress**: Free (major advantage over AWS S3)

For a typical PPT processing application:
- 10GB storage ≈ $0.15/month
- 10,000 file operations ≈ $0.05/month
- **Total**: ~$0.20/month for moderate usage

Much cheaper than AWS S3 due to free egress!