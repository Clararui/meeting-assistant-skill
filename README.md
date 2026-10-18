# 会议助理 Skill

把录音、转写初稿和课件，整理成可以直接阅读和复习的中文 Markdown 图文笔记。

适用于课程笔记、会议纪要、多段录音合并、转写纠错，以及为已有笔记补充课件图表。面向支持 `SKILL.md` 的智能体，不绑定某个转写平台或付费 API。

## 写出来是什么样

- 直接讲清知识，不反复写“老师说”“会议里分享了”。
- 用“举例”展开真实材料中的案例，保留背景、做法和结果。
- 一个总标题，正文只使用二级标题。
- 默认不放回看时间、逐段来源说明和模板式免责声明。
- 结合课件补充架构、流程、参数和操作步骤，配图跟在对应内容旁边。
- 会议资料保留决议、负责人和行动项；课程资料按知识结构整理。
- 输出 Markdown；需要图文时附独立 HTML 预览和图片 ZIP。

## 安装

使用支持 Agent Skills 的安装器：

```bash
npx skills add Clararui/meeting-assistant-skill --skill meeting-assistant
```

也可以下载仓库，将 `meeting-assistant/` 目录复制到所用工具的个人 Skills 目录。界面名称为 **会议助理 Skill**，调用名为 `$meeting-assistant`。

## 使用示例

```text
使用 $meeting-assistant，根据这两份课程转写和课件链接生成笔记。
保持 Markdown 格式，用一级、二级标题；直接陈述内容，展开案例，
把有用的课件图表放在对应章节下面，方便复制到飞书。
```

```text
使用 $meeting-assistant，把这段会议录音整理成纪要。
列出已确认决议、行动项、负责人和截止时间，未明确的信息标待定。
```

已有转写时优先复用；没有转写时使用当前工具可用的 ASR。Skill 不捆绑转写模型、API Key 或浏览器登录，不会自行上传资料到其他服务。

## 图文包装工具

只有生成 HTML 和 ZIP 时需要 Node.js 20+：

```bash
cd meeting-assistant
npm install --ignore-scripts
node scripts/package_notes.mjs /path/to/notes.md --out-dir /path/to/delivery
npm test
```

将引用图片放在 Markdown 目录内，例如 `assets/flow.png`。脚本会检查路径、标题和代码块，生成离线图文页与仅包含实际引用文件的压缩包。它不负责抓取录音、生成内容或验证事实。

HTML 提供“复制全部图文”按钮。飞书等编辑器对图文剪贴板的支持不同，粘贴后应检查图片；也可以使用压缩包里的 Markdown 和图片。

## 文件结构

```text
meeting-assistant/
  SKILL.md
  agents/openai.yaml
  references/writing-style.md
  references/illustrated-notes.md
  scripts/package_notes.mjs
  tests/package-notes.test.mjs
  package.json
```

本仓库只包含工作规则和工具。说明中的示例为虚构，不含真实录音、私人链接、聊天记录或课程课件。

## License

MIT
