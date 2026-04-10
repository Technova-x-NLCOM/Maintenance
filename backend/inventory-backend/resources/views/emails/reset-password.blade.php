<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 16px;
            margin-bottom: 20px;
        }
        .message {
            margin-bottom: 30px;
            font-size: 14px;
            color: #666;
        }
        .cta-section {
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 30px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 15px;
            transition: background-color 0.3s ease;
        }
        .cta-button:hover {
            background-color: #5568d3;
        }
        .reset-link-section {
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            word-break: break-all;
        }
        .reset-link-section p {
            margin: 0;
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
        }
        .reset-link-section a {
            color: #667eea;
            font-size: 13px;
        }
        .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
            font-size: 13px;
            color: #856404;
        }
        .warning strong {
            color: #721c24;
        }
        .footer {
            background-color: #f9f9f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #888;
            border-top: 1px solid #e0e0e0;
        }
        .footer p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hello <strong>{{ $userName }}</strong>,</p>
            </div>
            
            <div class="message">
                <p>We received a request to reset the password for your NLCOM Inventory System account. If you did not make this request, you can safely ignore this email.</p>
            </div>
            
            <div class="cta-section">
                <p><strong>Click the button below to reset your password:</strong></p>
                <a href="{{ $resetUrl }}" class="cta-button">Reset Password</a>
            </div>
            
            <div class="reset-link-section">
                <p>Or copy and paste this link into your browser:</p>
                <a href="{{ $resetUrl }}">{{ $resetUrl }}</a>
            </div>
            
            <div class="warning">
                <strong>Important:</strong> This password reset link will expire in 60 minutes. If the link expires, you can request a new password reset.
            </div>
            
            <div class="message">
                <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>NLCOM Inventory Management System</strong></p>
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; {{ date('Y') }} NLCOM. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
