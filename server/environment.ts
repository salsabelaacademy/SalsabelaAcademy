export function validateEnvironment(env:NodeJS.ProcessEnv=process.env){
 if(env.GEMINI_MODEL&&!/^[a-z0-9.-]+$/.test(env.GEMINI_MODEL))throw new Error('Invalid GEMINI_MODEL');
 if(env.NODE_ENV!=='production')return;
 const missing=['DATABASE_URL','SESSION_SECRET','FRONTEND_URL','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','RESEND_API_KEY','RESEND_FROM'].filter(k=>!env[k]);
 if(missing.length)throw new Error('Missing production variables: '+missing.join(', '));
 if((env.SESSION_SECRET?.length||0)<32)throw new Error('SESSION_SECRET must contain at least 32 characters');
 const origin=new URL(env.FRONTEND_URL!);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('FRONTEND_URL must be an HTTPS origin');
 if(!/^postgres(?:ql)?:/.test(env.DATABASE_URL!))throw new Error('DATABASE_URL must use PostgreSQL');
 const push=['WEB_PUSH_PUBLIC_KEY','WEB_PUSH_PRIVATE_KEY','WEB_PUSH_SUBJECT'];
 if(push.some(k=>env[k]) && push.some(k=>!env[k]))throw new Error('Incomplete Web Push configuration');
 if(env.WEB_PUSH_SUBJECT && !/^mailto:[^\s@]+@[^\s@]+$/.test(env.WEB_PUSH_SUBJECT))throw new Error('WEB_PUSH_SUBJECT must be a mailto contact');
 if(env.WEB_PUSH_PUBLIC_KEY && !/^[A-Za-z0-9_-]{87}$/.test(env.WEB_PUSH_PUBLIC_KEY))throw new Error('Invalid Web Push public key');
 if(env.WEB_PUSH_PRIVATE_KEY && !/^[A-Za-z0-9_-]{43}$/.test(env.WEB_PUSH_PRIVATE_KEY))throw new Error('Invalid Web Push private key');
 const zoom=['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_HOST_USER_ID'],google=['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
 for(const group of [zoom,google])if(group.some(k=>env[k])&&group.some(k=>!env[k]))throw new Error('Incomplete integration variables: '+group.join(', '));
 if([...zoom,...google].some(k=>env[k])&&!/^[a-f\d]{64}$/i.test(env.INTEGRATION_ENCRYPTION_KEY||''))throw new Error('INTEGRATION_ENCRYPTION_KEY must be 64 hexadecimal characters');
 if(!/^[0-5]$/.test(env.TRUST_PROXY_HOPS||'0'))throw new Error('Invalid TRUST_PROXY_HOPS');
}
