const normalizeReviews = (data) => {
  if (!data || !Array.isArray(data.reviews)) {
    return {
      success: false,
      error: "NORMALIZATION_FAILED",
      reviews: []
    };
  }

  const cleanHTML = (str) => str.replace(/<[^>]*>/g, '');

  const reviews = data.reviews.map(review => ({
    // reviewName is the full resource path required by replyToReview
    reviewName: review.name,
    reviewId: review.reviewId,
    reviewer: review.reviewer ? review.reviewer.displayName : 'Anonymous',
    reviewerProfilePhoto: review.reviewer ? review.reviewer.profilePhotoUrl || null : null,
    starRating: review.starRating,
    comment: review.comment ? cleanHTML(review.comment) : '',
    createTime: review.createTime || null,
    updateTime: review.updateTime || null,
    hasReply: !!(review.reviewReply && review.reviewReply.comment),
    replyComment: review.reviewReply ? review.reviewReply.comment : null,
    replyUpdateTime: review.reviewReply ? review.reviewReply.updateTime : null,
  }));

  return {
    success: true,
    totalReviewCount: data.totalReviewCount || reviews.length,
    averageRating: data.averageRating || null,
    reviews,
  };
};

const normalizeQuestions = (data) => {
  if (!data || !Array.isArray(data.questions)) {
    return {
      success: false,
      questions: []
    };
  }

  const questions = data.questions.map(q => ({
    questionId: q.name,
    author: q.author ? q.author.displayName : 'Anonymous',
    text: q.text,
    answerCount: q.totalAnswerCount || 0,
    topAnswer: q.topAnswer ? q.topAnswer.text : null
  }));

  return {
    success: true,
    questions
  };
};

const normalizeMedia = (data) => {
  if (!data || !Array.isArray(data.mediaItems)) {
    return {
      success: false,
      media: []
    };
  }

  const media = data.mediaItems.map(m => ({
    mediaId: m.name,
    type: m.mediaFormat,
    googleUrl: m.googleUrl,
    thumbnailUrl: m.thumbnailUrl,
    createTime: m.createTime
  }));

  return {
    success: true,
    media
  };
};

const normalizeServices = (data) => {
  if (!data || !Array.isArray(data.serviceItems)) {
    return {
      success: false,
      services: []
    };
  }

  const services = data.serviceItems
    .filter(item => item.isOffered !== false)
    .map(item => {
      if (item.structuredServiceItem) {
        return {
          type: 'structured',
          serviceTypeId: item.structuredServiceItem.serviceTypeId,
          displayName: item.structuredServiceItem.displayName || '',
          description: item.structuredServiceItem.description || ''
        };
      }
      if (item.freeFormServiceItem) {
        const label = item.freeFormServiceItem.label || {};
        return {
          type: 'freeForm',
          serviceTypeId: null,
          displayName: label.displayName || '',
          description: label.description || ''
        };
      }
      return null;
    })
    .filter(Boolean);

  return {
    success: true,
    services
  };
};

const normalizeProfile = (data) => {
  if (!data) {
    return {
      success: false,
      error: "NORMALIZATION_FAILED"
    };
  }

  return {
    success: true,
    profile: {
      locationId: data.name ? data.name.split('/').pop() : '',
      title: data.title || '',
      address: data.storefrontAddress || {},
      website: data.websiteUri || '',
      description: data.description || '',
      phone: data.phoneNumbers ? (data.phoneNumbers.primaryPhone || '') : '',
      categories: data.categories ? {
        primary: data.categories.primaryCategory ? data.categories.primaryCategory.displayName : '',
        additional: data.categories.additionalCategories ? data.categories.additionalCategories.map(c => c.displayName) : []
      } : {},
      hours: data.regularHours || {},
      specialHours: data.specialHours || {},
      serviceArea: data.serviceArea || {},
      metadata: data.metadata || {},
      latlng: data.latlng || {}
    }
  };
};

const normalizeAttributes = (data) => {
  if (!data) return { success: false, attributes: [] };

  const attrs = Array.isArray(data) ? data : (data.attributes || []);

  if (attrs.length === 0) {
    return {
      success: true,
      attributes: []
    };
  }

  return {
    success: true,
    attributes: attrs
  };
};

const normalizeInsights = (data) => {
  if (!data) return { success: false, error: "NO_DATA", insights: [] };

  // Handle various Performance API response formats
  // 1. fetchMultiDailyMetricsTimeSeries (array)
  // 2. getDailyMetricsTimeSeries (direct object with dailyMetricTimeSeries)
  // 3. getDailyMetricsTimeSeries (direct object with timeSeries/datedValues)
  
  let seriesArray = [];
  if (data.multiDailyMetricTimeSeries) {
    seriesArray = data.multiDailyMetricTimeSeries;
  } else if (data.dailyMetricTimeSeries) {
    seriesArray = [data];
  } else if (data.timeSeries && data.timeSeries.datedValues) {
    // This is the format seen in the recent test (direct timeSeries object)
    seriesArray = [data];
  }

  if (seriesArray.length === 0) {
    return {
      success: true,
      message: "No performance data found for the selected period.",
      insights: []
    };
  }

  const insights = seriesArray.map(metricSeries => {
    // Format A: dailyMetricTimeSeries[0]
    const seriesA = metricSeries.dailyMetricTimeSeries && metricSeries.dailyMetricTimeSeries[0];
    // Format B: timeSeries
    const seriesB = metricSeries.timeSeries;

    if (seriesA) {
      const dailyValues = seriesA.dailyValues || [];
      const total = dailyValues.reduce((sum, dv) => sum + (parseInt(dv.value) || 0), 0);
      return {
        metric: seriesA.dailyMetric,
        total: total,
        raw: dailyValues
      };
    }

    if (seriesB) {
      const datedValues = seriesB.datedValues || [];
      const total = datedValues.reduce((sum, dv) => sum + (parseInt(dv.value) || 0), 0);
      // Metric is usually provided in the request, but we can label it here
      return {
        metric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', // Default if not in response
        total: total,
        raw: datedValues
      };
    }

    return null;
  }).filter(Boolean);

  return {
    success: true,
    insights
  };
};

const normalizePosts = (data) => {
  if (!data || !Array.isArray(data.localPosts)) {
    return {
      success: false,
      posts: []
    };
  }

  const posts = data.localPosts.map(post => ({
    name: post.name,
    postId: post.name ? post.name.split('/').pop() : '',
    languageCode: post.languageCode,
    summary: post.summary || '',
    callToAction: post.callToAction || {},
    media: post.media || [],
    state: post.state,
    createTime: post.createTime,
    updateTime: post.updateTime,
    searchUrl: post.searchUrl
  }));

  return {
    success: true,
    posts
  };
};

module.exports = { 
  normalizeReviews, 
  normalizeQuestions, 
  normalizeMedia, 
  normalizeServices,
  normalizeProfile,
  normalizeAttributes,
  normalizeInsights,
  normalizePosts
};
