// 获取知乎热榜的脚本
// 由于知乎官方API有访问限制，我们使用一个公开的第三方接口来获取热榜信息

async function getZhihuHot() {
  try {
    // 使用第三方API获取知乎热榜，例如使用v2ex的API（注意：这只是一个示例，实际可能需要寻找合适的API）
    console.log('正在获取知乎热榜...');
    
    // 注意：以下是一个示例URL，实际可能需要使用其他公开API或手动访问知乎网站
    const response = await fetch('https://tenapi.cn/zhihuhot/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('知乎热榜数据:', data);
    } else {
      console.log('请求失败，状态码:', response.status);
      
      // 如果上面的API不可用，尝试备用方法
      console.log('提示：由于知乎的反爬虫机制，直接获取热榜数据可能受限。');
      console.log('建议手动访问知乎热榜页面获取最新信息：https://www.zhihu.com/hot');
    }
  } catch (error) {
    console.error('获取知乎热榜时发生错误:', error);
    console.log('由于知乎的反爬虫策略，可能无法直接通过API获取数据。');
    console.log('建议直接访问知乎热榜页面查看：https://www.zhihu.com/hot');
  }
}

// 执行函数
getZhihuHot();