(() => {
  if (!window.BlogArticles || !Array.isArray(window.BlogArticles.zh)) return;

  const article = {
    id: 'ai-ledger-real-streaming',
    title: 'AI Ledger 的真实流式回复：从网络分块到 Compose 稳定渲染',
    shortTitle: '真实流式回复',
    date: '2026-07-16',
    size: '31 KB',
    category: 'Android 开发',
    readTime: '16 分钟阅读',
    words: '约 4800 字',
    summary: '拆解 AI Ledger 如何把云端模型的增量输出，稳定地送进 Android 状态层与 Compose 消息气泡。',
    body: `
      <p class="article-lead">聊天界面里的文字逐字出现，看起来像一个很简单的动画，但“视觉上像流式”和“数据真的在流式传输”是两件完全不同的事。AI Ledger 最终采用的是一条真实的端到端流式链路：云端模型持续产生增量文本，Android 网络层持续读取分块，ViewModel 将内容累计到同一条助手消息，Jetpack Compose 再根据这条消息的变化进行局部重组。打字机尾迹、思考动画和完成态揭示只负责视觉表达，不参与伪造数据流。</p>

      <h2>为什么不能只做一个打字机动画</h2>
      <p>最容易实现的方案，是等待后端返回完整答案，然后在本地用定时器逐字显示。它确实能够制造“正在生成”的视觉感，但用户在模型完成前拿不到任何有效内容，首字延迟仍然等于整段回答的总生成时间。长回答越长，这个问题越明显。</p>
      <p>真实流式传输解决的是交互时延，而不是单纯的动画效果。模型只要生成了第一段有效文本，客户端就可以立刻展示；后续内容继续到达时，已有正文保持可读，用户不必面对一个长时间停留在“正在思考”的空白气泡。</p>
      <blockquote>真实流式的判断标准不是文字有没有逐字出现，而是完整答案尚未生成时，客户端是否已经收到并呈现了模型的部分输出。</blockquote>

      <h2>完整链路由四层共同完成</h2>
      <p>这套链路没有把所有职责压进一个函数，而是明确分成四层：</p>
      <ol>
        <li><strong>云端生成层：</strong>模型以流式模式持续产生文本增量和协议事件；</li>
        <li><strong>网络传输层：</strong><code>AiWorkerClient.streamChat()</code> 发起请求，并通过回调把每一个有效增量交给上层；</li>
        <li><strong>状态管理层：</strong><code>AssistantViewModel</code> 把增量追加进缓冲区，定期刷新同一条助手消息；</li>
        <li><strong>界面渲染层：</strong><code>MessageBubbleV2</code> 根据消息状态选择实时内容或完成态内容，Compose 只更新发生变化的部分。</li>
      </ol>
      <div class="article-callout">
        <strong>核心原则</strong>
        <span>每次到达的 chunk 只是同一条消息的新内容，不是一条新的聊天消息。消息身份、列表位置和气泡父级绘制关系在整个生成过程中保持稳定。</span>
      </div>

      <h2>网络层：以回调交付真实文本增量</h2>
      <p><code>AiWorkerClient</code> 对上层暴露的不是“返回完整字符串”的普通请求，而是带有文本增量回调的挂起函数。它仍然会在流结束后返回完整的 <code>ChatResponse</code>，但生成期间每一段正文都会先通过 <code>onTextDelta</code> 送出。</p>
      <div class="article-code"><div class="code-title">STREAM CONTRACT</div><pre><code>suspend fun streamChat(
    request: ChatRequest,
    onTextDelta: suspend (String) -&gt; Unit
): ChatResponse</code></pre></div>
      <p>请求载荷会明确开启流式模式，并携带稳定的会话标识。底层传输收到响应分块后，不等待整个响应体结束，而是持续解析文本事件；正文交给 <code>onTextDelta</code>，会话信息、进度信息等协议事件则走独立的事件通道。这样，用户可见文字与系统控制信息不会混成一段难以维护的字符串。</p>
      <p>流结束时，客户端仍会解析最终载荷，更新可信的 provider session、response id 和 conversation id，并形成完整响应。换句话说，增量回调负责实时体验，最终响应负责会话完整性，两者并不冲突。</p>

      <h2>ViewModel：先创建占位消息，再持续更新它</h2>
      <p>用户发送消息后，ViewModel 会立即在列表尾部加入一条状态为 <code>MessageStatus.Sending</code> 的助手消息。它拥有固定的消息 id，并先显示“正在思考…”或“正在理解视觉附件…”。随后，当前请求会把这个 id 记录为 <code>activePendingMessageId</code>，后续所有增量都只允许写入这条消息。</p>
      <p>从结构上看，过程可以简化为下面这样：</p>
      <div class="article-code"><div class="code-title">SIMPLIFIED VIEWMODEL FLOW</div><pre><code>val pendingMessage = createAssistantMessage(
    status = MessageStatus.Sending
)
appendMessage(pendingMessage)

aiWorkerClient.streamChat(request) { delta -&gt;
    streamBuffer.append(delta)
}

flushStreamingText(force = true)
markMessageCompleted(pendingMessage.id)</code></pre></div>
      <p>这里最重要的不是字符串相加，而是“固定消息身份”。如果每个增量都创建一条新消息，LazyColumn 会不断插入项目，滚动锚点会发生变化，气泡动画会被重复触发，消息操作栏、附件、数据卡片和 OpenGL 父级绘制关系也会变得不稳定。更新同一个 id，才能让整个气泡在生成期间保持连续。</p>

      <h2>为什么增加 80 ms 的流式平滑层</h2>
      <p>网络 chunk 的大小和到达间隔并不稳定。有时一次只到达一两个字符，有时会突然到达一整句；如果每个 chunk 都立刻写入 Compose 状态，界面可能在极短时间内发生大量重组，文字节奏也会忽快忽慢。</p>
      <p>因此 ViewModel 没有直接把网络回调绑定到 UI，而是先将 delta 追加到线程安全的 <code>streamBuffer</code>，再由独立协程大约每 80 ms 调用一次 <code>flushStreamingText(false)</code>。刷新函数会根据当前可用长度、理想分段和距离上次刷新所经过的时间，决定本轮应当展示到哪里。流关闭时再执行一次强制刷新，保证最后一段内容不会滞留在缓冲区。</p>
      <div class="article-code"><div class="code-title">SMOOTHED FLUSH</div><pre><code>val streamSmootherJob = launch {
    while (!streamClosed) {
        delay(STREAM_FLUSH_INTERVAL_MS)
        flushStreamingText(false)
    }
}

streamClosed = true
streamSmootherJob.cancel()
flushStreamingText(true)</code></pre></div>
      <p>这层设计并没有把真实流式改成假流式。数据仍然是随网络到达的，只是 UI 更新被整理成更稳定的节拍。它同时降低了高频状态写入、消息列表重组和富文本重复解析的压力。</p>

      <h2>同一条消息如何做到低成本替换</h2>
      <p>每次刷新时，ViewModel 会用当前累计文本构造新的 <code>ChatMessage</code>，状态仍保持 <code>Sending</code>，然后定点替换消息列表中的目标项。当前实现还使用了 <code>ChatMessageOverlayList</code>：它保留原始列表，只让指定索引持有可变替换值。这样不必在每一个流式刷新周期都复制整份消息列表，也能缩小 Compose 实际观察到的变化范围。</p>
      <div class="article-code"><div class="code-title">MESSAGE UPDATE</div><pre><code>updateStreamingMessage(
    pendingMessage.id,
    pendingMessage.copy(
        text = nextText,
        status = MessageStatus.Sending,
        source = "cloud_ai"
    )
)</code></pre></div>
      <p>这一优化的目标不是减少功能，而是在保留完整消息链的前提下控制重组成本。公式渲染、实时数据卡片、联网结果、附件、徽标、消息操作栏和长回复折叠仍然属于原来的气泡体系，没有因为流式性能优化而被替换或降级。</p>

      <h2>Compose：根据消息状态选择两套内容路径</h2>
      <p>消息进入 <code>MessageBubbleV2</code> 后，会先判断它是否仍处于发送状态。生成期间使用 <code>StreamingAssistantContentV2</code>；流结束并进入稳定态后，则转入 <code>GeneratingMessageContentV2</code> 和普通富文本内容链。</p>
      <div class="article-code"><div class="code-title">BUBBLE STATE SWITCH</div><pre><code>if (sending) {
    StreamingAssistantContentV2(
        message = message,
        smoothState = smoothStreamingState
    )
} else {
    GeneratingMessageContentV2(
        text = displayText,
        active = revealActive
    )
}</code></pre></div>
      <p><code>StreamingAssistantContentV2</code> 读取的是消息当前已经累计出的正文，而不是另建一份脱离消息模型的临时文本。只要已经出现有效正文，就交给 <code>RichMessageContent</code> 渲染，因此 Markdown、公式和结构化内容能够跟随真实数据逐步出现。尚未出现正文时，界面才使用 <code>SweepingProgressTextV2</code> 与 <code>ThinkingDotsV2</code> 表示等待状态。</p>
      <p>这种设计把“数据是否已经到达”和“界面应该如何表现”分开了。网络层不需要知道动画，动画层也不需要猜测模型是否完成。</p>

      <h2>完成态不是突然替换整块正文</h2>
      <p>当网络流正常结束后，ViewModel 会先强制冲刷剩余缓冲文本，再把消息状态切换为完成态。界面随后通过 <code>rememberRevealTextStateV2</code>、<code>revealedMessageIds</code> 和 <code>revealFinished</code> 管理收尾过程。</p>
      <p><code>TypewriterTrailV2</code> 可以继续提供轻微的尾迹和完成感，但它只是视觉层，不承担网络流式职责；<code>LongReplyToggleV2</code>、<code>MessageActionsV2</code>、<code>MessageAttachmentListV2</code>、<code>MessageBadgeV2</code> 与数据卡片，则在合适的完成阶段恢复完整交互。</p>
      <p>这样可以避免两种常见问题：第一，流结束的一瞬间整段内容被重新创建，导致气泡高度和滚动位置突跳；第二，复制、重试等操作在内容尚未稳定时过早出现。</p>

      <h2>工具调用为什么仍能保持在同一条会话链里</h2>
      <p>AI Ledger 的聊天并不只有纯文本。模型可能在生成过程中请求客户端工具，例如执行设备控制。<code>AiWorkerClient.streamChat()</code> 会解析工具调用，交给客户端执行器处理，再把结构化结果以 <code>[[AI_LEDGER_CLIENT_TOOL_RESULT_V1]]</code> 协议回传云端。云端模型获得真实执行结果后继续下一轮生成，直到形成最终回复。</p>
      <p>这意味着工具执行不是本地偷偷拼接一段答案，也不是另开一条无上下文请求。模型输出、客户端动作、真实结果和后续回答都属于同一个会话闭环。对于用户来说，中间可能经历观察、执行和继续生成，但最终仍落在一条连续的助手消息中。</p>

      <h2>为什么这条链路必须保护聊天气泡和 OpenGL 宿主</h2>
      <p>首页聊天区同时包含复杂的 Compose 消息、持续滚动和 OpenGL 大玻璃。流式文本会不断改变气泡高度，如果状态设计不稳定，很容易把问题放大成列表跳动、底边抖动或玻璃几何同步频繁触发。</p>
      <p>因此实现流式传输时，没有让模型栏展开高度直接压缩聊天区的真实布局，也没有改写 OpenGL Host 的尺寸链。<code>FixedHeightOverflowSlot</code>、<code>modelPanelVisualHeight</code>、<code>modelExpandDelta</code>、<code>LocalOpenGLGlassSurfaceAnchor</code> 与 <code>viewportTopInset</code> 共同维持大玻璃的稳定边界；消息内部则继续沿用原有父级绘制关系。</p>
      <p>流式优化只缩小状态读取范围、稳定消息参数和控制刷新节奏，而不通过删除富文本、附件、数据卡片或动画来换取表面上的性能提升。这是整个实现中非常重要的边界。</p>

      <h2>异常、停止与最终一致性</h2>
      <p>真实流式还必须处理取消和失败。用户主动停止时，请求协程会被取消，当前消息转入停止状态；网络或 Worker 出错时，缓冲区会先执行最后一次强制刷新，再将错误信息写入同一条消息。所有路径都会检查 <code>activePendingMessageId</code>，防止旧请求在新请求开始后继续覆盖界面。</p>
      <p>最终响应到达后，还需要用完整结果校正累计文本、结构化数据、模型标签和工具结果。增量流负责“尽快显示”，最终载荷负责“保证完整”，两者共同形成最终一致性。</p>

      <h2>实现这套流式链路后得到的经验</h2>
      <ul>
        <li><strong>先保证数据真实，再讨论动画。</strong> 本地逐字播放不能替代网络层流式；</li>
        <li><strong>chunk 不等于 UI 帧。</strong> 网络分块应先缓冲，再以稳定节拍刷新界面；</li>
        <li><strong>一条回复必须只有一个稳定身份。</strong> 增量更新同一消息，而不是不断插入消息；</li>
        <li><strong>实时态和完成态应明确分层。</strong> 传输、状态、富文本和收尾动画各自负责一件事；</li>
        <li><strong>性能优化不能破坏功能链。</strong> 应缩小重组范围，而不是删掉公式、卡片、附件或视觉细节；</li>
        <li><strong>工具调用也要留在会话协议内。</strong> 执行结果必须回传模型，再由模型继续完成回答。</li>
      </ul>

      <h2>结语</h2>
      <p>AI Ledger 的流式回复最终不是一个单独的“流式组件”，而是一条从云端协议、网络读取、协程调度、状态更新到 Compose 渲染的完整通路。真正决定体验的，也不只是首字出现得快，而是文字持续增长时，消息身份、滚动位置、富文本能力、工具闭环和 OpenGL 玻璃都能保持稳定。</p>
      <p>把真实数据流和视觉表达彻底分层之后，流式传输才不再是一段容易失控的动画，而成为整个聊天系统可以长期扩展的基础设施。</p>
    `
  };

  const existingIndex = window.BlogArticles.zh.findIndex((item) => item.id === article.id);
  if (existingIndex >= 0) {
    window.BlogArticles.zh[existingIndex] = article;
  } else {
    window.BlogArticles.zh.unshift(article);
  }
})();