import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configuration de Cloudinary avec les variables d'environnement
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration du stockage : on indique à Multer d'envoyer les fichiers vers Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'newket_assets', // Le dossier qui sera créé sur votre compte Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], // Formats autorisés par sécurité
    // Vous pouvez ajouter d'autres options ici si besoin
  },
});

// Création et exportation du middleware
export const uploadMiddleware = multer({ storage: storage });
