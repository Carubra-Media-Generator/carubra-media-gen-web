import { NextRequest, NextResponse } from 'next/server'
import { initializeVertexAI, getGenerativeModel, validateVertexConfig, getVertexConfig } from '@/lib/vertex'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Validate configuration
    try {
      validateVertexConfig()
    } catch (configError: any) {
      return NextResponse.json({
        success: false,
        error: 'Configuration validation failed',
        detail: configError.message,
        config: getVertexConfig(),
      }, { status: 500 })
    }

    // Initialize Vertex AI client
    let vertexAI
    try {
      vertexAI = initializeVertexAI()
    } catch (initError: any) {
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize Vertex AI client',
        detail: initError.message,
        config: getVertexConfig(),
      }, { status: 500 })
    }

    // Get generative model
    let model
    try {
      model = getGenerativeModel()
    } catch (modelError: any) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get generative model',
        detail: modelError.message,
        config: getVertexConfig(),
      }, { status: 500 })
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Vertex AI client initialized successfully',
      config: getVertexConfig(),
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      detail: error.message,
      config: getVertexConfig(),
    }, { status: 500 })
  }
}
