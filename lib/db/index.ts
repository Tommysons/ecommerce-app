import mongoose from 'mongoose'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cached = (global as any).mongoose || { conn: null, promise: null }

export const connectToDatabase = async (MONGODB_URI: string | undefined) => {
  if (cached.conn) {
    console.log('Using existing MongoDB connection')
    return cached.conn
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing')
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable Mongoose buffering
    }

    console.log('Attempting to connect to MongoDB...')
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('New MongoDB connection established')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    console.error('MongoDB connection error:', err)
    throw err
  }

  return cached.conn
}
