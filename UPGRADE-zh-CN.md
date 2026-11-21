# StartPro Wiki Reader v0.3.0-beta.1 升级、验证与回滚

本说明面向 **1Panel + crazymax/flarum + Docker** 的现有论坛：容器 `1Panel-flarum-iZUW`，Flarum `2.0.2`，LR Wiki `1.11.1`。

> 该版本已完成静态检查和模拟测试，但尚未通过真实数据库迁移与生产手机浏览器测试。此前测试版曾触发 HTTP 500，生产部署存在风险。即使沿用原容器，也建议在低峰期操作、提前准备可恢复的数据库备份。

## 1. 首先保全数据

1. 在 1Panel **实际导出并验证** MySQL 数据库备份；另备份宿主持久化目录 `/opt/1panel/apps/flarum/flarum/data` 和 `docker-compose.yml`。
2. 确认现有论坛/书签（v0.1 Beta 5 或 v0.2）仍可使用。记录安装版本：

```bash
sudo docker exec 1Panel-flarum-iZUW composer show startpro/wiki-reader
sudo docker exec 1Panel-flarum-iZUW php flarum info
sudo docker exec 1Panel-flarum-iZUW extension list
```

3. 把操作中断窗口安排在允许短暂服务异常的时间；**不必重装或删除 LR Wiki**。

## 2. 发布到 GitHub + Packagist（服务器安装前）

Mac `~/Downloads` 中先备份旧源码工作区，再解压覆盖仓库、提交并打标签。不要将 `v0.3` 标签提前指向旧源码：

```bash
cd ~/Downloads/flarum-wiki-reader
git pull --ff-only origin main
unzip -oq ~/Downloads/StartPro-Wiki-Reader-GitHub-Source-v0.3.0-beta.1.zip -d .
git status
git add -A
git diff --cached --stat
git commit -m "feat: Wiki Reader 0.3 books, highlights and reading stats"
git push origin main
git tag -a v0.3.0-beta.1 -m "Wiki Reader v0.3 beta"
git push origin v0.3.0-beta.1
```

检查 https://packagist.org/packages/startpro/wiki-reader 是否已经出现 `v0.3.0-beta.1`。**未出现之前，不执行服务器升级**。

## 3. 受控升级

```bash
# A. 禁用旧版，保留已有数据
sudo docker exec 1Panel-flarum-iZUW php flarum extension:disable startpro-wiki-reader

# B. 精确安装新测试版，crazymax 扩展清单会持久记录
sudo docker exec 1Panel-flarum-iZUW extension require 'startpro/wiki-reader:0.3.0-beta.1'

# C. 确认包版本
sudo docker exec 1Panel-flarum-iZUW composer show startpro/wiki-reader

# D. 启用并完成增量迁移（新增5张表，不会重写旧书签）
sudo docker exec 1Panel-flarum-iZUW php flarum extension:enable startpro-wiki-reader
sudo docker exec 1Panel-flarum-iZUW php flarum migrate
sudo docker exec 1Panel-flarum-iZUW php flarum cache:clear

# E. 检查论坛首页
curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://blog.startpro.com.cn/
```

预期 HTTP 200；重定向站点可能是 301/302，需要再检查实际跳转终点。

若 `storage/cache` 发生权限错误，先查看目录属主与模式，不要对整个 `/opt/flarum` 运行 `chmod 777`。必要时仅修复缓存子目录：

```bash
sudo docker exec -u 0 1Panel-flarum-iZUW sh -c 'chown -R flarum:flarum /opt/flarum/storage/cache'
sudo docker exec 1Panel-flarum-iZUW php flarum cache:clear
```

## 4. 生产验收顺序

**先验证论坛可用，再检查新功能。**

- 首页、后台、LR Wiki、发帖图片和老书签均能正常操作；开发者工具无新 JS 初始化错误。
- PC/手机同一账户：新建书签→恢复位置→搜索旧书签→改备注→刷新后仍正常。
- 选中**同一段落**内的一句话，点击 `✍ 划线`；进入「划线笔记」修改笔记后，从手机登录同一账户查看。注意：手机浏览器不支持 CSS Highlight API 时可能不显示页面内黄色划线，但笔记列表必须可见。
- 用论坛管理员打开一篇 Wiki 文章→「我的书架」→创建书籍→关联当前文章，指定排序号；普通用户应看不到管理员编排入口。
- 将至少两篇文章关联到同一本书，尝试标记读完、取消标记。书籍进度必须按**人工完成篇数**统计，而不是按滚动百分比。
- 「阅读统计」应显示读者账号自己的书签/划线数量和估算阅读时长。停在后台标签页不应持续增加时间。
- 验证两个不同账号：个人划线及笔记必须相互隔离；旧数据不能丢。

## 5. 出现问题时立即止损

如果再次引发首页 HTTP 500、前端 JS 初始化失败、或其他严重问题，先禁用扩展：

```bash
sudo docker exec 1Panel-flarum-iZUW php flarum extension:disable startpro-wiki-reader
sudo docker exec 1Panel-flarum-iZUW php flarum cache:clear
```

取最新日志（隐藏 Cookie、密钥后分享）：

```bash
sudo docker exec 1Panel-flarum-iZUW sh -c 'cd /opt/flarum && f=$(ls -t storage/logs/*.log | head -n 1) && tail -n 120 "$f"'
sudo docker logs --since 10m 1Panel-flarum-iZUW 2>&1 | tail -n 100
```

**不要点击 Purge、不要 DROP 数据表。** 若确定要回退至原插件版本，先维持禁用，确认数据库备份可恢复，再将 Composer 包约束改回之前记录的版本并重新启用。新增的 v0.3 表应暂时保留；回退代码后它们不会被旧版使用。涉及数据损坏时，应使用已验证的数据库备份进行专门恢复，而不是盲目执行 down migration。
